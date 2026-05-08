import { execFileSync } from 'child_process';
import config from '../../config.js';

export function scanPorts() {
  const output = execFileSync('lsof', ['-i', '-P', '-n'], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'ignore'],
  });

  const ports = new Map();

  for (const line of output.split('\n')) {
    if (!line.includes('(LISTEN)')) continue;

    const portMatch = line.match(/TCP\s+\S+:(\d+)\s+\(LISTEN\)/);
    if (!portMatch) continue;

    const port = parseInt(portMatch[1]);
    if (port === config.port) continue;

    const parts = line.split(/\s+/);
    const command = parts[0];
    const pid = parseInt(parts[1]);

    if (!config.devProcesses.has(command)) continue;
    if (isNaN(pid) || ports.has(port)) continue;

    ports.set(port, { port, pid, command });
  }

  return ports;
}
