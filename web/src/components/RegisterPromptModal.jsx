import { useState } from 'react';

const PROMPT = `请帮我将当前项目注册到 LocalServiceHub（运行在 http://localhost:9900）。

1. 分析当前项目结构，判断项目类型、启动命令和端口。
2. startCommand 使用结构化格式；前后端分离项目用数组；projectDir 填项目根目录，cwd 可指向子目录；不要把整条命令写进 cmd，也不要使用 /bin/bash、bash、sh、zsh、fish、osascript 或 /bin/bash -lc。复杂启动逻辑请写成项目内脚本后注册，例如 {"cmd":"./scripts/start-backend.sh","args":[],"cwd":"<项目根目录>"}。
3. 虚拟环境 Python 可使用项目内 .venv/bin/python 的绝对路径。
4. 注册后调用 /api/projects 和 /api/services 验证结果。

执行注册：

curl -X POST http://localhost:9900/api/projects/register \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "<项目名>",
    "description": "<一句话描述>",
    "projectDir": "<项目绝对路径>",
    "startCommand": [
      {"cmd":"<后端命令>","args":["<参数>"],"cwd":"<后端目录>"},
      {"cmd":"<前端命令>","args":["<参数>"],"cwd":"<前端目录>"}
    ],
    "ports": [<后端端口>, <前端端口>]
  }'
`;

export default function RegisterPromptModal({ onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal prompt-modal" onClick={e => e.stopPropagation()}>
        <h2>注册提示词</h2>
        <p className="prompt-hint">复制以下提示词，粘贴到小工具项目的 Claude 对话中，即可自动注册到面板。</p>
        <textarea className="prompt-textarea" rows={16} readOnly value={PROMPT} />
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>关闭</button>
          <button className="btn primary" onClick={handleCopy}>
            {copied ? '已复制' : '复制提示词'}
          </button>
        </div>
      </div>
    </div>
  );
}
