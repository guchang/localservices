import { scanPorts } from '../scanner/port-scanner.js';
import { getBatchProcessDetails } from '../scanner/process-inspector.js';

const FRONTEND_FRAMEWORKS = new Set(['vite', 'next', 'react', 'vue', 'angular', 'nuxt', 'svelte', 'gatsby', 'tauri']);
const BACKEND_FRAMEWORKS = new Set(['express', 'koa', 'hapi', 'flask', 'django', 'fastapi', 'python-uvicorn', 'python-flask', 'gunicorn', 'spring']);
const SUBPROJECT_DIRS = new Set(['frontend', 'backend', 'web', 'client']);

function classifyRole(framework) {
  if (FRONTEND_FRAMEWORKS.has(framework)) return 'frontend';
  if (BACKEND_FRAMEWORKS.has(framework)) return 'backend';
  return 'unknown';
}

function normalizeCwd(cwd, projectDirs) {
  if (!cwd) return null;
  const parts = cwd.split('/');
  // Walk up ancestor chain to find a registered projectDir
  for (let i = parts.length; i >= 1; i--) {
    const candidate = parts.slice(0, i).join('/');
    if (projectDirs.has(candidate)) {
      return candidate;
    }
  }
  // Fallback: strip well-known subproject dir name
  const last = parts[parts.length - 1]?.toLowerCase();
  if (SUBPROJECT_DIRS.has(last)) {
    return parts.slice(0, -1).join('/');
  }
  return cwd;
}

function pathToId(p) {
  return p.replace(/\//g, '-').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
}

export class ProjectMatcher {
  #registry;

  constructor(registry) {
    this.#registry = registry;
  }

  match(spawnedByPid = new Map()) {
    const portMap = scanPorts();
    const pids = [...new Set([...portMap.values()].map(p => p.pid))];
    const processDetails = getBatchProcessDetails(pids);

    const portEntries = [];
    for (const [port, portInfo] of portMap) {
      const details = processDetails.get(portInfo.pid);
      portEntries.push({ port, portInfo, details });
    }

    // Build port→serviceId from spawned services' expectedPorts
    const portToServiceId = new Map();
    const spawnedServiceIds = new Set(spawnedByPid.values());
    for (const serviceId of spawnedServiceIds) {
      const project = this.#registry.get(serviceId);
      if (project?.expectedPorts) {
        for (const p of project.expectedPorts) {
          portToServiceId.set(p, serviceId);
        }
      }
    }

    // Group: spawned services match by port; others by normalized cwd
    const groups = new Map();
    const projectDirs = new Set(this.#registry.getAll().map(p => p.projectDir));
    for (const entry of portEntries) {
      const key = portToServiceId.get(entry.port)
        || normalizeCwd(entry.details?.cwd, projectDirs)
        || `port-${entry.port}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }

    const services = [];
    const usedProjectIds = new Set();

    for (const [key, entries] of groups) {
      const project = this.#findBestProject(key, entries);
      if (project) usedProjectIds.add(project.id);

      if (entries.length === 1) {
        const e = entries[0];
        services.push({
          id: project?.id || `port-${e.port}`,
          name: project?.name || this.#generateName(e.portInfo, e.details),
          status: 'online',
          url: `http://localhost:${e.port}`,
          port: e.port,
          pid: e.portInfo.pid,
          cwd: e.details?.cwd || null,
          command: e.details?.command || null,
          framework: e.details?.framework || project?.framework || 'unknown',
          projectId: project?.id || null,
          projectDir: project?.projectDir || e.details?.cwd || null,
          description: project?.description || null,
          expectedPorts: project?.expectedPorts || [],
          startCommand: project?.startCommand || null,
        });
      } else {
        services.push({
          id: project?.id || pathToId(key),
          name: project?.name || key.split('/').pop(),
          status: 'online',
          framework: project?.framework || 'unknown',
          projectId: project?.id || null,
          projectDir: project?.projectDir || key,
          description: project?.description || null,
          expectedPorts: project?.expectedPorts || [],
          startCommand: project?.startCommand || null,
          ports: entries.map(e => ({
            port: e.port,
            pid: e.portInfo.pid,
            cwd: e.details?.cwd || null,
            command: e.details?.command || null,
            framework: e.details?.framework || 'unknown',
            url: `http://localhost:${e.port}`,
            role: classifyRole(e.details?.framework || project?.framework || 'unknown'),
          })),
        });
      }
    }

    for (const project of this.#registry.getAll()) {
      if (usedProjectIds.has(project.id)) continue;
      for (const key of groups.keys()) {
        if (key.startsWith(project.projectDir + '/')) {
          usedProjectIds.add(project.id);
        }
      }
    }

    for (const project of this.#registry.getAll()) {
      if (!usedProjectIds.has(project.id)) {
        services.push({
          id: project.id,
          name: project.name,
          status: 'offline',
          url: null,
          port: null,
          pid: null,
          cwd: null,
          command: null,
          framework: project.framework,
          projectId: project.id,
          expectedPorts: project.expectedPorts,
          startCommand: project.startCommand || null,
          projectDir: project.projectDir,
          description: project.description || null,
        });
      }
    }

    return services;
  }

  #matchProject(port, details) {
    if (details?.cwd) {
      const project = this.#registry.findByCwd(details.cwd);
      if (project) return project;
    }
    return this.#registry.findByPort(port);
  }

  #findBestProject(groupKey, entries) {
    // If groupKey is a registered project ID (from spawnedByPid), return it directly
    const directProject = this.#registry.get(groupKey);
    if (directProject) return directProject;

    let best = null;
    for (const entry of entries) {
      const project = this.#matchProject(entry.port, entry.details);
      if (!project) continue;
      if (groupKey === project.projectDir || project.projectDir.startsWith(groupKey + '/')) {
        if (!best || project.projectDir.length > best.projectDir.length) {
          best = project;
        }
      }
    }
    return best;
  }

  #generateName(portInfo, details) {
    if (details?.framework && details.framework !== 'unknown') {
      return `${details.framework} (${portInfo.port})`;
    }
    return `${portInfo.command}:${portInfo.port}`;
  }
}
