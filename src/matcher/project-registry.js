import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import config from '../../config.js';

const PROJECTS_FILE = join(config.dataDir, 'projects.json');

export class ProjectRegistry {
  #projects = new Map();

  async init() {
    if (existsSync(PROJECTS_FILE)) {
      try {
        const data = JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));
        for (const p of data) {
          this.#projects.set(p.id, p);
        }
        this.#backfillStartCommands();
      } catch {
        this.#save();
      }
    }
  }

  getAll() {
    return [...this.#projects.values()];
  }

  get(id) {
    return this.#projects.get(id);
  }

  findByCwd(cwd) {
    if (!cwd) return null;
    let best = null;
    for (const project of this.#projects.values()) {
      if (cwd.startsWith(project.projectDir)) {
        if (!best || project.projectDir.length > best.projectDir.length) {
          best = project;
        }
      }
    }
    return best;
  }

  findByPort(port) {
    for (const project of this.#projects.values()) {
      if (project.expectedPorts?.includes(port)) return project;
    }
    return null;
  }

  add(project) {
    this.#projects.set(project.id, project);
    this.#save();
    return project;
  }

  update(id, updates) {
    const existing = this.#projects.get(id);
    if (!existing) return null;
    this.#projects.set(id, { ...existing, ...updates });
    this.#save();
    return this.#projects.get(id);
  }

  remove(id) {
    const deleted = this.#projects.delete(id);
    this.#save();
    return deleted;
  }

  #save() {
    const data = [...this.#projects.values()];
    writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
  }

  #backfillStartCommands() {
    let changed = false;
    for (const [, project] of this.#projects) {
      if (project.startCommand !== undefined) continue;
      const pkgPath = join(project.projectDir, 'package.json');
      let cmd = null;
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          const scripts = pkg.scripts || {};
          const scriptName = scripts.dev ? 'dev' : scripts.start ? 'start' : null;
          if (scriptName) cmd = { cmd: 'npm', args: ['run', scriptName], cwd: project.projectDir };
        } catch {}
      }
      if (!cmd) {
        const candidates = ['main.py', 'app.py', 'server.py', 'manage.py'];
        for (const f of candidates) {
          if (existsSync(join(project.projectDir, f))) {
            cmd = { cmd: 'python3', args: [f], cwd: project.projectDir };
            break;
          }
        }
      }
      project.startCommand = cmd;
      changed = true;
    }
    if (changed) this.#save();
  }
}
