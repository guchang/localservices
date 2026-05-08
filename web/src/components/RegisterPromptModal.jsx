import { useState } from 'react';

const PROMPT = `请帮我将当前项目注册到 LocalServiceHub（运行在 http://localhost:9900）。

步骤：
1. 读取当前项目的 package.json、配置文件，分析项目类型
2. 确定启动命令（如 npm run dev、python -m uvicorn main:app --port 8000）
3. 确定项目占用的端口号
4. 执行以下 curl 命令完成注册：

curl -X POST http://localhost:9900/api/projects/register \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "<项目名>",
    "description": "<一句话描述>",
    "projectDir": "<项目绝对路径>",
    "startCommand": {"cmd":"<命令>","args":["<参数>"],"cwd":"<工作目录>"},
    "ports": [<端口号>]
  }'

如果是前后端分离项目，startCommand 用数组：
"startCommand": [
  {"cmd":"npm","args":["run","dev"],"cwd":"<前端目录>"},
  {"cmd":"python3","args":["-m","uvicorn","main:app","--port","8000"],"cwd":"<后端目录>"}
]

如果后端需要虚拟环境，cmd 用 venv 里的 python 绝对路径：
{"cmd":"/path/to/.venv/bin/python","args":["-m","uvicorn","main:app","--port","8000"],"cwd":"<后端目录>"}`;

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
