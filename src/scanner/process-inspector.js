import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const FRAMEWORK_SIGNATURES = [
  { pattern: /next-server/i, framework: 'next' },
  { pattern: /vite/i, framework: 'vite' },
  { pattern: /uvicorn/i, framework: 'python-uvicorn' },
  { pattern: /flask/i, framework: 'python-flask' },
  { pattern: /tauri/i, framework: 'tauri' },
];

export function getProcessDetails(pid) {
  let cwd = null;
  let command = null;

  try {
    const lsofOutput = execFileSync('lsof', ['-p', String(pid)], {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    for (const line of lsofOutput.split('\n')) {
      if (line.includes('cwd')) {
        const parts = line.trim().split(/\s+/);
        cwd = parts[parts.length - 1];
      }
    }
  } catch {}

  try {
    command = execFileSync('ps', ['-o', 'command=', '-p', String(pid)], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
  } catch {}

  const framework = detectFramework(command, cwd);
  return { pid, cwd, command, framework };
}

export function getBatchProcessDetails(pids) {
  const results = new Map();
  for (const pid of pids) {
    results.set(pid, getProcessDetails(pid));
  }
  return results;
}

function detectFramework(command, cwd) {
  if (command) {
    for (const { pattern, framework } of FRAMEWORK_SIGNATURES) {
      if (pattern.test(command)) return framework;
    }
  }
  if (cwd) {
    if (hasFile(cwd, 'next.config.js') || hasFile(cwd, 'next.config.ts') || hasFile(cwd, 'next.config.mjs')) return 'next';
    if (hasFile(cwd, 'vite.config.js') || hasFile(cwd, 'vite.config.ts')) return 'vite';
    if (hasFile(cwd, 'nuxt.config.js') || hasFile(cwd, 'nuxt.config.ts')) return 'nuxt';
  }
  if (command && /node\s+server\.js/i.test(command)) return 'express';
  return 'unknown';
}

function hasFile(dir, filename) {
  return dir && existsSync(join(dir, filename));
}
