import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';
import { ProjectRegistry } from '../matcher/project-registry.js';
import { ProjectMatcher } from '../matcher/project-matcher.js';
import config from '../../config.js';

export class ServiceMonitor extends EventEmitter {
  #wss;
  #registry;
  #matcher;
  #intervalId = null;
  #currentServices = [];

  constructor(wss) {
    super();
    this.#wss = wss;
    this.#registry = new ProjectRegistry();
    this.#matcher = new ProjectMatcher(this.#registry);
  }

  async init() {
    await this.#registry.init();
    this.#currentServices = this.#matcher.match();
  }

  start() {
    this.#tick();
    this.#intervalId = setInterval(() => this.#tick(), config.scanInterval);
  }

  stop() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  getServices() {
    const online = this.#currentServices.filter(s => s.status === 'online');
    const offline = this.#currentServices.filter(s => s.status === 'offline');
    return {
      timestamp: new Date().toISOString(),
      services: this.#currentServices,
      summary: {
        total: this.#currentServices.length,
        online: online.length,
        offline: offline.length,
      },
    };
  }

  getRegistry() {
    return this.#registry;
  }

  getServiceById(id) {
    return this.#currentServices.find(s => s.id === id) || null;
  }

  async triggerScan() {
    await this.#registry.autoDiscover();
    this.#tick();
    return this.getServices();
  }

  #tick() {
    try {
      const newServices = this.#matcher.match();
      const changes = this.#diffServices(this.#currentServices, newServices);
      this.#currentServices = newServices;

      if (changes.length > 0) {
        this.#broadcastChanges(changes);
      }
    } catch (err) {
      console.error('Scan error:', err.message);
    }
  }

  #diffServices(oldServices, newServices) {
    const changes = [];
    const oldMap = new Map(oldServices.map(s => [s.id, s]));
    const newMap = new Map(newServices.map(s => [s.id, s]));

    for (const [id, newSvc] of newMap) {
      const oldSvc = oldMap.get(id);
      const portChanged = oldSvc?.ports
        ? JSON.stringify(oldSvc.ports.map(p => p.port)) !== JSON.stringify(newSvc.ports?.map(p => p.port))
        : oldSvc?.port !== newSvc.port;
      if (!oldSvc || oldSvc.status !== newSvc.status || portChanged) {
        changes.push({
          id,
          oldStatus: oldSvc?.status || 'offline',
          newStatus: newSvc.status,
          service: newSvc,
        });
      }
    }

    for (const [id, oldSvc] of oldMap) {
      if (!newMap.has(id)) {
        changes.push({
          id,
          oldStatus: oldSvc.status,
          newStatus: 'offline',
          service: { ...oldSvc, status: 'offline', port: null, pid: null },
        });
      }
    }

    return changes;
  }

  #broadcastChanges(changes) {
    const msg = JSON.stringify({ type: 'status_change', data: changes });
    for (const client of this.#wss.clients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
  }
}
