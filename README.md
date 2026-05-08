# LocalServiceHub

本地开发服务统一管理面板。自动发现本机运行中的端口服务，提供启动/停止/重启等管理操作。

## 功能

- 自动扫描本机端口，识别运行中的服务进程
- 手动注册项目，关联启动命令和端口
- 一键启动 / 停止 / 重启服务
- WebSocket 实时推送服务状态变更
- 支持 AI 提示词注册：复制提示词到 Claude 对话中自动完成项目注册

## 技术栈

- **后端**: Node.js + Express + WebSocket (ws)
- **前端**: React 19 + Vite 8
- **端口扫描**: lsof 系统命令
- **进程管理**: Node.js child_process

## 安装

```bash
git clone https://github.com/guchang/localservices.git
cd localservices
npm install
cd web && npm install && cd ..
npm run build
```

## 使用

```bash
# 生产模式
npm start

# 开发模式（前后端热更新）
npm run dev:all
```

启动后访问 http://localhost:9900。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `9900` | 服务端口 |
| `SCAN_INTERVAL` | `5000` | 端口扫描间隔（毫秒） |

### 注册项目

1. **手动注册** — 点击「手动注册」，填写项目名、目录、启动命令
2. **提示词注册** — 点击「注册提示词」，复制提示词粘贴到项目的 Claude 对话中

注册示例（curl）：

```bash
curl -X POST http://localhost:9900/api/projects/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my-project",
    "description": "我的项目",
    "projectDir": "/path/to/project",
    "startCommand": {"cmd":"npm","args":["run","dev"],"cwd":"/path/to/project"},
    "ports": [3000]
  }'
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/services` | 获取所有服务状态 |
| GET | `/api/services/online` | 获取在线服务 |
| GET | `/api/projects` | 获取所有已注册项目 |
| POST | `/api/projects` | 添加项目 |
| POST | `/api/projects/register` | 注册项目并刷新 |
| DELETE | `/api/projects/:id` | 删除项目 |
| PATCH | `/api/projects/:id` | 更新项目 |
| POST | `/api/services/:id/start` | 启动服务 |
| POST | `/api/services/:id/stop` | 停止服务 |
| POST | `/api/services/:id/restart` | 重启服务 |

## License

MIT
