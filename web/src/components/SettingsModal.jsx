import { useState, useEffect } from 'react';

export default function SettingsModal({ onClose, onSave, isOnboarding }) {
  const [dirs, setDirs] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => setDirs((s.projectRoots || []).join('\n')))
      .catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const projectRoots = dirs.split('\n').map(d => d.trim()).filter(Boolean);
    setLoading(true);
    try {
      await onSave({ projectRoots });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>扫描目录配置</h2>
        <form onSubmit={handleSave}>
          <label>项目根目录（每行一个路径）</label>
          <textarea
            className="settings-textarea"
            rows={5}
            placeholder={"/Users/me/projects\n/home/me/code"}
            value={dirs}
            onChange={e => setDirs(e.target.value)}
          />
          <p className="settings-hint">配置后点击「重新发现」或「立即扫描」将扫描这些目录下的项目</p>
          <div className="modal-actions">
            {isOnboarding && (
              <button type="button" className="btn" onClick={onClose}>跳过</button>
            )}
            {!isOnboarding && (
              <button type="button" className="btn" onClick={onClose}>取消</button>
            )}
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? '保存中...' : '保存并扫描'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
