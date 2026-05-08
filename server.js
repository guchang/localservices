import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import config from './config.js';
import { registerRoutes } from './src/api/routes.js';
import { ServiceMonitor } from './src/monitor/service-monitor.js';
import { ProcessManager } from './src/manager/process-manager.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

if (!existsSync(config.dataDir)) mkdirSync(config.dataDir, { recursive: true });

const monitor = new ServiceMonitor(wss);
await monitor.init();

const processManager = new ProcessManager(monitor);

registerRoutes(app, monitor, processManager);

if (existsSync(config.publicDir)) {
  app.use(express.static(config.publicDir));
  app.get('*', (req, res) => {
    res.sendFile(join(config.publicDir, 'index.html'));
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'full_state', data: monitor.getServices() }));
});

server.listen(config.port, () => {
  console.log(`LocalServiceHub running at http://localhost:${config.port}`);
  monitor.start();
});
