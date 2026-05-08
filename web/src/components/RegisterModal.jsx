import { useState } from 'react';

export default function RegisterModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', projectDir: '', expectedPorts: '', framework: '', startCommand: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        projectDir: form.projectDir,
        expectedPorts: form.expectedPorts.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
        framework: form.framework || 'unknown',
        startCommand: form.startCommand || null,
      });
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>注册项目</h2>
        <form onSubmit={handleSubmit}>
          <label>项目名称</label>
          <input
            placeholder="My Project"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <label>项目目录</label>
          <input
            placeholder="/path/to/project"
            value={form.projectDir}
            onChange={e => setForm(f => ({ ...f, projectDir: e.target.value }))}
            required
          />
          <label>预期端口（逗号分隔）</label>
          <input
            placeholder="3000, 3001"
            value={form.expectedPorts}
            onChange={e => setForm(f => ({ ...f, expectedPorts: e.target.value }))}
          />
          <label>框架</label>
          <input
            placeholder="express / next / vite"
            value={form.framework}
            onChange={e => setForm(f => ({ ...f, framework: e.target.value }))}
          />
          <label>启动命令（可选）</label>
          <input
            placeholder="npm run dev"
            value={form.startCommand}
            onChange={e => setForm(f => ({ ...f, startCommand: e.target.value }))}
          />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>取消</button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? '注册中...' : '注册'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
