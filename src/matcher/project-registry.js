import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { readdirSync } from 'fs';
import config from '../../config.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.next', '.nuxt', '.vite', 'coverage', '.cache',
]);

const PROJECTS_FILE = join(config.dataDir, 'projects.json');

export class ProjectRegistry {
  #projects = new Map();

  async init() {
    if (existsSync(PROJECTS_FILE)) {
      const data = JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));
      for (const p of data) {
        this.#projects.set(p.id, p);
      }
      this.#backfillStartCommands();
    } else {
      await this.autoDiscover();
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

  async autoDiscover() {
    for (const root of config.projectRoots) {
      if (!existsSync(root)) continue;
      this.#scanDirectory(root, 0);
    }
    this.#save();
  }

  #scanDirectory(dir, depth) {
    if (depth > 5) return;

    if (dir === config.dataDir.replace('/data', '') || dir.includes('localservices')) return;

    const hasServer = existsSync(join(dir, 'server.js')) || existsSync(join(dir, 'server.py'));
    const hasFrontend = existsSync(join(dir, 'vite.config.js')) || existsSync(join(dir, 'vite.config.ts')) ||
      existsSync(join(dir, 'next.config.js')) || existsSync(join(dir, 'next.config.ts')) || existsSync(join(dir, 'next.config.mjs'));
    const hasPackageJson = existsSync(join(dir, 'package.json'));

    if (hasServer || hasFrontend) {
      const id = this.#generateId(dir);
      if (!this.#projects.has(id)) {
        const project = this.#buildProject(dir, id);
        if (project) this.#projects.set(id, project);
      }
    }

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
        this.#scanDirectory(join(dir, name), depth + 1);
      }
    } catch {}
  }

  #generateId(dir) {
    const relative = this.#getRelativePath(dir);
    return relative.replace(/[/\\]/g, '-').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
  }

  #getRelativePath(dir) {
    for (const root of config.projectRoots) {
      if (dir.startsWith(root)) {
        return dir.slice(root.length + 1);
      }
    }
    return basename(dir);
  }

  #buildProject(dir, id) {
    const pkgPath = join(dir, 'package.json');
    let name = this.#getRelativePath(dir);
    let expectedPorts = [];
    let startCommand = null;

    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        name = pkg.name || name;
        expectedPorts = extractPortsFromPkg(pkg, dir);
        startCommand = resolveStartCommand(dir, pkg);
      } catch {}
    }

    if (!startCommand) {
      startCommand = resolvePythonStartCommand(dir);
    }

    const envPath = join(dir, '.env');
    if (existsSync(envPath)) {
      try {
        const envContent = readFileSync(envPath, 'utf-8');
        const portMatch = envContent.match(/PORT=(\d+)/);
        if (portMatch && !expectedPorts.includes(parseInt(portMatch[1]))) {
          expectedPorts.push(parseInt(portMatch[1]));
        }
      } catch {}
    }

    return {
      id,
      name,
      projectDir: dir,
      expectedPorts,
      framework: detectFrameworkFromDir(dir),
      autoDiscovered: true,
      startCommand,
    };
  }

  #save() {
    const data = [...this.#projects.values()];
    writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
  }

  #backfillStartCommands() {
    let changed = false;
    for (const [id, project] of this.#projects) {
      if (project.startCommand !== undefined) continue;
      const pkgPath = join(project.projectDir, 'package.json');
      let cmd = null;
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
          cmd = resolveStartCommand(project.projectDir, pkg);
        } catch {}
      }
      if (!cmd) cmd = resolvePythonStartCommand(project.projectDir);
      project.startCommand = cmd;
      changed = true;
    }
    if (changed) this.#save();
  }
}

function extractPortsFromPkg(pkg, dir) {
  const ports = [];
  const scripts = pkg.scripts || {};
  const devScript = scripts.dev || scripts.start || '';

  const portMatch = devScript.match(/(?:--port|-p)\s+(\d+)/);
  if (portMatch) ports.push(parseInt(portMatch[1]));

  if (ports.length === 0) {
    const viteConfig = ['vite.config.js', 'vite.config.ts']
      .find(f => existsSync(join(dir, f)));
    if (viteConfig) {
      try {
        const content = readFileSync(join(dir, viteConfig), 'utf-8');
        const serverPortMatch = content.match(/port:\s*(\d+)/);
        if (serverPortMatch) ports.push(parseInt(serverPortMatch[1]));
        else if (content.includes('vite')) ports.push(5173);
      } catch {}
    }
  }

  if (ports.length === 0 && devScript.includes('next')) {
    ports.push(3000);
  }

  return ports;
}

function detectFrameworkFromDir(dir) {
  const checks = [
    ['next.config.js', 'next'], ['next.config.ts', 'next'], ['next.config.mjs', 'next'],
    ['vite.config.js', 'vite'], ['vite.config.ts', 'vite'],
    ['nuxt.config.js', 'nuxt'], ['nuxt.config.ts', 'nuxt'],
  ];
  for (const [file, framework] of checks) {
    if (existsSync(join(dir, file))) return framework;
  }
  if (existsSync(join(dir, 'server.py'))) return 'python';
  if (existsSync(join(dir, 'server.js'))) return 'express';
  return 'unknown';
}

function resolveStartCommand(dir, pkg) {
  const scripts = pkg.scripts || {};
  const scriptName = scripts.dev ? 'dev' : scripts.start ? 'start' : null;
  if (!scriptName) return null;
  return { cmd: 'npm', args: ['run', scriptName], cwd: dir };
}

function resolvePythonStartCommand(dir) {
  const candidates = ['app.py', 'main.py', 'server.py', 'manage.py'];
  for (const f of candidates) {
    if (existsSync(join(dir, f))) {
      return { cmd: 'python', args: [f], cwd: dir };
    }
  }
  return null;
}
