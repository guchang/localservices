# LocalServiceHub

**[中文](README.md)**

A local development service management dashboard. Centralize all your local projects in one page — view online status, access URLs, and start/stop/restart services. Ideal for managing multiple frontend, backend, or script services side by side.

Screenshot:

![LocalServiceHub dashboard](docs/dashboard.png)

## Why

As Vibe Coding becomes more addictive, I kept running into these problems: forgetting which projects I've built, forgetting port numbers, forgetting what's still running in the background, forgetting how to start each project.

So I built LocalServiceHub with a simple goal: turn all these local services into visible, operable project cards.

## Highlights

- **AI Registration**: Built-in registration prompt — copy it into your Coding Agent and let AI analyze the project structure and call the LocalServiceHub API to register automatically.
- **Unified Dashboard**: Auto-scans local ports, distinguishes online from offline projects, and displays clickable access links.
- **One-click Lifecycle Management**: Start, stop, and restart registered projects without switching terminals.
- **Frontend + Backend Support**: One project can have multiple start commands and listen on multiple ports (e.g., backend API + frontend Vite).
- **Structured Start Commands**: Commands are split into `cmd`, `args`, and `cwd` instead of raw shell strings — more stable and manageable.
- **Security Boundary**: Rejects shell wrappers like `bash`, `sh`, `zsh`, `fish`, `osascript` by default. For complex logic, put it in a project script and register that instead.
- **Robust Process Management**: Spawned services detach from the Hub's stdio and write to log files. Restarting or stopping the Hub won't kill child services.
- **Real-time Updates**: Backend scans ports via `lsof` and pushes state changes over WebSocket — no manual refresh needed.

## Tech Stack

- Backend: Node.js, Express, WebSocket (`ws`)
- Frontend: React 19, Vite 8
- Port scanning: `lsof`
- Process management: Node.js `child_process`

## Getting Started

```bash
git clone https://github.com/guchang/localservicehub.git
cd localservicehub
npm install
cd web && npm install && cd ..
npm run build
npm start
```

Then visit:

```text
http://localhost:9900
```

Development mode:

```bash
npm run dev:all
```

## Registering Projects

Two options:

- 🌟 **Recommended**: Click "Register Prompt", copy the prompt into your project's AI chat, and let AI analyze and register the project.
- Click "Manual Register" to fill in project directory, ports, and start command yourself.

Structured start commands are recommended. For a single service:

```json
{
  "cmd": "npm",
  "args": ["run", "dev"],
  "cwd": "/path/to/project"
}
```

For frontend + backend projects, use an array:

```json
[
  {
    "cmd": "python3",
    "args": ["-m", "uvicorn", "main:app", "--port", "8000"],
    "cwd": "/path/to/project/backend"
  },
  {
    "cmd": "npm",
    "args": ["run", "dev"],
    "cwd": "/path/to/project/frontend"
  }
]
```

For complex startup logic, wrap it in a script:

```json
{
  "cmd": "./scripts/start-backend.sh",
  "args": [],
  "cwd": "/path/to/project"
}
```

Python virtual environments can use the absolute path to `.venv/bin/python`.

Full registration example:

```bash
curl -X POST http://localhost:9900/api/projects/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my-project",
    "description": "My local dev project",
    "projectDir": "/path/to/project",
    "startCommand": [
      {"cmd":"python3","args":["-m","uvicorn","main:app","--port","8000"],"cwd":"/path/to/project/backend"},
      {"cmd":"npm","args":["run","dev"],"cwd":"/path/to/project/frontend"}
    ],
    "ports": [8000, 3000]
  }'
```

Verify registration:

```bash
curl http://localhost:9900/api/projects
curl http://localhost:9900/api/services
```

## Commands

| Command | Description |
| --- | --- |
| `npm start` | Start production server |
| `npm run dev` | Start backend only with Node watch |
| `npm run dev:web` | Start frontend Vite dev server only |
| `npm run dev:all` | Start both frontend and backend in dev mode |
| `npm run build` | Build frontend and copy to `public/` |

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `9900` | Hub server port |
| `SCAN_INTERVAL` | `5000` | Port scan interval in milliseconds |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/services` | Get all services |
| `GET` | `/api/services/online` | Get online services |
| `GET` | `/api/projects` | Get all registered projects |
| `POST` | `/api/projects` | Add a project |
| `POST` | `/api/projects/register` | Register a project and refresh services |
| `PATCH` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `POST` | `/api/services/:id/start` | Start a service |
| `POST` | `/api/services/:id/stop` | Stop a service |
| `POST` | `/api/services/:id/restart` | Restart a service |

## License

MIT
