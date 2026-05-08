import { spawn } from 'child_process';
import { mkdirSync, createWriteStream, existsSync } from 'fs';
import { join } from 'path';
import config from '../../config.js';

const STOP_TIMEOUT = 5000;

export class ProcessManager {
  #spawned = new Map();
  #logDir;
  #monitor;

  constructor(monitor) {
    this.#monitor = monitor;
    this.#logDir = join(config.dataDir, 'logs');
    if (!existsSync(this.#logDir)) mkdirSync(this.#logDir, { recursive: true });
  }

  async start(serviceId, commands) {
    const cmds = Array.isArray(commands) ? commands : [commands];
    const pids = [];

    for (const cmd of cmds) {
      const logStream = createWriteStream(join(this.#logDir, `${serviceId}.log`), { flags: 'a' });
      const child = spawn(cmd.cmd, cmd.args, {
        cwd: cmd.cwd,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '1' },
      });
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
      child.on('close', () => logStream.close());
      child.unref();

      const pid = child.pid;
      pids.push(pid);

      child.on('error', (err) => {
        console.error(`Process ${pid} error:`, err.message);
        logStream.close();
      });
    }

    this.#spawned.set(serviceId, { pids, startedAt: new Date() });
    await new Promise(r => setTimeout(r, 1500));
    await this.#monitor.triggerScan();
  }

  async stop(serviceId, pids) {
    const pidList = Array.isArray(pids) ? pids : [pids];
    const kills = pidList.filter(Boolean).map(pid => this.#killProcess(pid));
    await Promise.all(kills);
    this.#spawned.delete(serviceId);
    await this.#monitor.triggerScan();
  }

  async restart(serviceId, commands, pids) {
    if (pids?.length) {
      await this.stop(serviceId, pids);
      await new Promise(r => setTimeout(r, 500));
    }
    await this.start(serviceId, commands);
  }

  getSpawned(serviceId) {
    return this.#spawned.get(serviceId);
  }

  getSpawnedByPid() {
    const map = new Map();
    for (const [serviceId, { pids }] of this.#spawned) {
      for (const pid of pids) {
        map.set(pid, serviceId);
      }
    }
    return map;
  }

  #killProcess(pid) {
    return new Promise((resolve) => {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        try { process.kill(pid, 'SIGKILL'); } catch {}
        resolve();
      }, STOP_TIMEOUT);

      const check = setInterval(() => {
        try {
          process.kill(pid, 0);
        } catch {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 200);
    });
  }
}
