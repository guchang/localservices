import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadSettings, saveSettings } from '../settings.js';

const SAFE_COMMANDS = new Set(['npm', 'npx', 'yarn', 'pnpm', 'bun', 'node', 'python', 'python3', 'deno']);

function validateStartCommand(cmd) {
  if (!cmd) return true;
  const cmds = Array.isArray(cmd) ? cmd : [cmd];
  return cmds.every(c => SAFE_COMMANDS.has(c.cmd));
}

export function registerRoutes(app, monitor, processManager) {
  app.get('/api/settings', (req, res) => {
    res.json(loadSettings());
  });

  app.post('/api/settings', async (req, res) => {
    const { projectRoots } = req.body;
    const settings = saveSettings({
      projectRoots: projectRoots || [],
      initialized: true,
    });
    const registry = monitor.getRegistry();
    await registry.autoDiscover(settings.projectRoots);
    const result = await monitor.triggerScan();
    res.json({ settings, services: result });
  });

  app.get('/api/services', (req, res) => {
    res.json(monitor.getServices());
  });

  app.get('/api/services/online', (req, res) => {
    const data = monitor.getServices();
    data.services = data.services.filter(s => s.status === 'online');
    res.json(data);
  });

  app.post('/api/services/scan', async (req, res) => {
    const result = await monitor.triggerScan();
    res.json(result);
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
    if (!validateStartCommand(startCommand)) {
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

  app.delete('/api/projects/:id', (req, res) => {
    const registry = monitor.getRegistry();
    const removed = registry.remove(req.params.id);
    res.json({ removed });
  });

  app.patch('/api/projects/:id', (req, res) => {
    const registry = monitor.getRegistry();
    const updated = registry.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: '项目不存在' });
    res.json(updated);
  });

  app.post('/api/projects/discover', async (req, res) => {
    const settings = loadSettings();
    const registry = monitor.getRegistry();
    await registry.autoDiscover(settings.projectRoots);
    res.json(registry.getAll());
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
