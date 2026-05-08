import { existsSync } from 'fs';
import { basename, isAbsolute, relative, resolve } from 'path';

const BLOCKED_COMMANDS = new Set(['bash', 'sh', 'zsh', 'fish', 'osascript']);
const SAFE_GLOBAL_COMMANDS = new Set([
  'npm', 'npx', 'yarn', 'pnpm', 'bun',
  'node', 'deno',
  'python', 'python3', 'uv', 'poetry', 'pipenv', 'uvicorn', 'flask', 'gunicorn',
  'go',
  'java', 'javac', 'mvn', 'gradle',
  'cargo', 'rustc',
  'dotnet',
  'ruby', 'bundle', 'rails',
  'php', 'composer',
]);
const UNSAFE_PROJECT_DIRS = new Set([
  '/', '/bin', '/sbin', '/usr', '/usr/bin', '/usr/sbin',
  '/System', '/Library', '/etc', '/var', '/private', '/tmp',
]);

function isInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function isPathLike(cmd) {
  return cmd?.startsWith('/') || cmd?.startsWith('./') || cmd?.startsWith('../');
}

function isUnsafeProjectDir(projectDir) {
  return UNSAFE_PROJECT_DIRS.has(resolve(projectDir));
}

function isProjectVenvPython(cmd, projectDir) {
  if (!cmd?.startsWith('/')) return false;
  const resolvedCmd = resolve(cmd);
  return isInside(projectDir, resolvedCmd)
    && resolvedCmd.includes('/.venv/bin/')
    && /^python(\d+(\.\d+)?)?$/.test(basename(resolvedCmd));
}

function isProjectLocalCommand(cmd, projectDir) {
  if (!isPathLike(cmd)) return false;
  if (isUnsafeProjectDir(projectDir)) return false;
  if (cmd.startsWith('/')) return isProjectVenvPython(cmd, projectDir);

  const resolvedCmd = resolve(projectDir, cmd);
  return isInside(projectDir, resolvedCmd);
}

function validateStartCommand(cmd, projectDir) {
  if (!cmd) return true;
  const cmds = Array.isArray(cmd) ? cmd : [cmd];
  const absProjectDir = resolve(projectDir);

  return cmds.every(c => {
    if (!c?.cmd || typeof c.cmd !== 'string') return false;
    if (c.args !== undefined && (!Array.isArray(c.args) || !c.args.every(arg => typeof arg === 'string'))) return false;
    if (c.cwd !== undefined && typeof c.cwd !== 'string') return false;
    if (BLOCKED_COMMANDS.has(basename(c.cmd))) return false;

    const cwd = c.cwd ? resolve(c.cwd) : absProjectDir;
    if (!isInside(absProjectDir, cwd)) return false;

    if (SAFE_GLOBAL_COMMANDS.has(c.cmd)) return true;
    return isProjectLocalCommand(c.cmd, absProjectDir);
  });
}

export function registerRoutes(app, monitor, processManager) {
  app.get('/api/services', (req, res) => {
    res.json(monitor.getServices());
  });

  app.get('/api/services/online', (req, res) => {
    const data = monitor.getServices();
    data.services = data.services.filter(s => s.status === 'online');
    res.json(data);
  });

  app.get('/api/projects', (req, res) => {
    const registry = monitor.getRegistry();
    res.json(registry.getAll());
  });

  app.post('/api/projects', (req, res) => {
    const registry = monitor.getRegistry();
    const { name, projectDir, expectedPorts, framework, startCommand } = req.body;
    if (!name || !projectDir) {
      return res.status(400).json({ error: 'name and projectDir are required' });
    }
    const absDir = resolve(projectDir);
    if (!existsSync(absDir)) {
      return res.status(400).json({ error: '项目目录不存在' });
    }
    if (!validateStartCommand(startCommand, absDir)) {
      return res.status(400).json({ error: '启动命令不在允许列表中' });
    }
    const id = absDir.split('/').filter(Boolean).pop().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const project = registry.add({
      id, name, projectDir: absDir,
      expectedPorts: expectedPorts || [],
      framework: framework || 'unknown',
      startCommand: startCommand || null,
      autoDiscovered: false,
    });
    res.json(project);
  });

  app.post('/api/projects/register', async (req, res) => {
    const { name, description, projectDir, startCommand, ports } = req.body;
    if (!name || !projectDir || !startCommand) {
      return res.status(400).json({ error: 'name, projectDir, startCommand 必填' });
    }
    const absDir = resolve(projectDir);
    if (!existsSync(absDir)) {
      return res.status(400).json({ error: '项目目录不存在' });
    }
    if (!validateStartCommand(startCommand, absDir)) {
      return res.status(400).json({ error: '启动命令不在允许列表中' });
    }
    const registry = monitor.getRegistry();
    const id = absDir.split('/').filter(Boolean).pop().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const project = registry.add({
      id, name, projectDir: absDir,
      description: description || '',
      expectedPorts: ports || [],
      framework: 'unknown',
      startCommand,
      autoDiscovered: false,
    });
    const services = monitor.refresh();
    res.json({ success: true, project, services });
  });

  app.delete('/api/projects/:id', async (req, res) => {
    const registry = monitor.getRegistry();
    const removed = registry.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: '项目不存在' });
    const services = monitor.refresh();
    res.json({ removed: true, services });
  });

  app.patch('/api/projects/:id', (req, res) => {
    const registry = monitor.getRegistry();
    const existing = registry.get(req.params.id);
    if (!existing) return res.status(404).json({ error: '项目不存在' });

    const projectDir = req.body.projectDir ? resolve(req.body.projectDir) : existing.projectDir;
    const updates = req.body.projectDir ? { ...req.body, projectDir } : req.body;
    if (req.body.projectDir && !existsSync(projectDir)) {
      return res.status(400).json({ error: '项目目录不存在' });
    }
    if (req.body.startCommand !== undefined && !validateStartCommand(req.body.startCommand, projectDir)) {
      return res.status(400).json({ error: '启动命令不在允许列表中' });
    }

    const updated = registry.update(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: '项目不存在' });
    res.json(updated);
  });

  app.post('/api/services/:id/start', async (req, res) => {
    const service = monitor.getServiceById(req.params.id);
    if (service?.status === 'online') {
      return res.status(409).json({ error: '服务已在运行' });
    }

    const registry = monitor.getRegistry();
    const project = registry.get(req.params.id);
    if (!project?.startCommand) {
      return res.status(400).json({ error: '未配置启动命令' });
    }
    if (!validateStartCommand(project.startCommand, project.projectDir)) {
      return res.status(400).json({ error: '启动命令不在允许列表中' });
    }

    try {
      await processManager.start(req.params.id, project.startCommand);
      const updated = monitor.getServiceById(req.params.id);
      res.json({ success: true, service: updated });
    } catch (err) {
      res.status(500).json({ error: `启动失败: ${err.message}` });
    }
  });

  app.post('/api/services/:id/stop', async (req, res) => {
    const service = monitor.getServiceById(req.params.id);
    if (!service || service.status !== 'online') {
      return res.status(409).json({ error: '服务未在运行' });
    }

    const pids = service.ports
      ? service.ports.map(p => p.pid).filter(Boolean)
      : [service.pid].filter(Boolean);

    try {
      await processManager.stop(req.params.id, pids);
      const updated = monitor.getServiceById(req.params.id);
      res.json({ success: true, service: updated });
    } catch (err) {
      res.status(500).json({ error: `停止失败: ${err.message}` });
    }
  });

  app.post('/api/services/:id/restart', async (req, res) => {
    const service = monitor.getServiceById(req.params.id);
    const registry = monitor.getRegistry();
    const project = registry.get(req.params.id);

    if (!project?.startCommand) {
      return res.status(400).json({ error: '未配置启动命令' });
    }
    if (!validateStartCommand(project.startCommand, project.projectDir)) {
      return res.status(400).json({ error: '启动命令不在允许列表中' });
    }

    const pids = service?.status === 'online'
      ? (service.ports
          ? service.ports.map(p => p.pid).filter(Boolean)
          : [service.pid].filter(Boolean))
      : [];

    try {
      await processManager.restart(req.params.id, project.startCommand, pids);
      const updated = monitor.getServiceById(req.params.id);
      res.json({ success: true, service: updated });
    } catch (err) {
      res.status(500).json({ error: `重启失败: ${err.message}` });
    }
  });
}
