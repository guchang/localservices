import { execFileSync, spawn } from 'child_process';
import { closeSync, existsSync, mkdirSync, openSync } from 'fs';
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
      const logPath = join(this.#logDir, `${serviceId}.log`);
      const stdoutFd = openSync(logPath, 'a');
      const stderrFd = openSync(logPath, 'a');
      const child = spawn(cmd.cmd, Array.isArray(cmd.args) ? cmd.args : [], {
        cwd: cmd.cwd,
        detached: true,
        stdio: ['ignore', stdoutFd, stderrFd],
        env: { ...process.env, FORCE_COLOR: '1' },
      });
      closeSync(stdoutFd);
      closeSync(stderrFd);
      child.unref();

      const pid = child.pid;
      if (pid) pids.push(pid);

      child.on('error', (err) => {
        console.error(`Process ${pid} error:`, err.message);
      });
    }

    this.#spawned.set(serviceId, { pids, startedAt: new Date() });
    await new Promise(r => setTimeout(r, 1500));
    await this.#monitor.triggerScan();
  }

  async stop(serviceId, pids) {
    const spawnedPids = this.#spawned.get(serviceId)?.pids || [];
    const requestedPids = Array.isArray(pids) ? pids : [pids];
    const pidList = [...new Set([...spawnedPids, ...requestedPids])];
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
      const pgid = this.#getProcessGroupId(pid);
      const targets = [...new Set([pgid ? -pgid : -pid, pid])];
      try {
        process.kill(targets[0], 'SIGTERM');
      } catch {
        try {
          process.kill(pid, 'SIGTERM');
        } catch {
          resolve();
          return;
        }
      }

      const timeout = setTimeout(() => {
        for (const target of targets) {
          try { process.kill(target, 'SIGKILL'); } catch {}
        }
        resolve();
      }, STOP_TIMEOUT);

      const check = setInterval(() => {
        const alive = targets.some(target => {
          try {
            process.kill(target, 0);
            return true;
          } catch {
            return false;
          }
        });
        if (!alive) {
          clearInterval(check);
          clearTimeout(timeout);
          resolve();
        }
      }, 200);
    });
  }

  #getProcessGroupId(pid) {
    try {
      const output = execFileSync('ps', ['-o', 'pgid=', '-p', String(pid)], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
      const pgid = parseInt(output, 10);
      return Number.isNaN(pgid) ? null : pgid;
    } catch {
      return null;
    }
  }
}
