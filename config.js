import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  port: parseInt(process.env.PORT || '9900'),
  scanInterval: parseInt(process.env.SCAN_INTERVAL || '5000'),
  projectRoots: (process.env.PROJECT_ROOTS || '/Volumes/HIKSEMI/codex_project').split(':'),
  dataDir: join(__dirname, 'data'),
  publicDir: join(__dirname, 'public'),
  devProcesses: new Set([
    'node', 'Python', 'python', 'python3',
    'uvicorn', 'flask', 'gunicorn',
    'ruby', 'java', 'go', 'deno', 'bun',
  ]),
};
