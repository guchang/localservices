import { useState, useRef, useEffect } from 'react';

const ROLE_LABELS = {
  frontend: '前端',
  backend: '后端',
  unknown: '',
};

export default function ServiceCard({ service, onStart, onStop, onRestart, onDelete }) {
  const [copied, setCopied] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const cardRef = useRef(null);
  const [flash, setFlash] = useState(false);
  const prevStatus = useRef(service.status);

  useEffect(() => {
    if (prevStatus.current !== service.status) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1000);
      prevStatus.current = service.status;
      return () => clearTimeout(t);
    }
  }, [service.status]);

  useEffect(() => {
    setActionLoading(null);
    setActionError(null);
  }, [service.status]);

  const isOnline = service.status === 'online';
  const isMultiPort = isOnline && service.ports?.length > 1;
  const openPort = isMultiPort
    ? service.ports.find(p => p.role === 'frontend')
      || service.ports.find(p => p.role !== 'backend')
      || service.ports[0]
    : null;
  const hasStartCommand = !!service.startCommand;

  const projectDir = service.projectDir;

  const handleCopyDir = () => {
    if (projectDir) {
      navigator.clipboard.writeText(projectDir);
      setCopied('dir');
      setTimeout(() => setCopied(null), 1500);
    }
  };

  const handleCopy = (url, port) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(port);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleAction = async (action, fn) => {
    setActionLoading(action);
    setActionError(null);
    try {
      await fn(service.id);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div ref={cardRef} className={`card ${isOnline ? 'online' : 'offline'} ${flash ? 'flash' : ''}`}>
      <div className="card-header">
        <div className="card-name">
          <span className={`status-dot ${service.status}`} />
          <h3>{service.name}</h3>
        </div>
        {service.framework && service.framework !== 'unknown' && !isMultiPort && (
          <span className="framework-badge">{service.framework}</span>
        )}
      </div>

      {service.description && (
        <div className="card-description">{service.description}</div>
      )}

      {projectDir && (
        <div className="card-dir" onClick={handleCopyDir} title="点击复制路径">
          <span className="dir-icon">📁</span>
          <span className="dir-path">{projectDir}</span>
          {copied === 'dir' && <span className="dir-copied">已复制</span>}
        </div>
      )}

      {isMultiPort ? (
        <div className="card-ports">
          {service.ports.map(p => (
            <div key={p.port} className="port-item">
              <div className="port-item-header">
                {ROLE_LABELS[p.role] && (
                  <span className={`role-badge ${p.role}`}>{ROLE_LABELS[p.role]}</span>
                )}
                {p.framework && p.framework !== 'unknown' && (
                  <span className="framework-badge small">{p.framework}</span>
                )}
              </div>
              <div className="card-url">
                <a href={p.url} target="_blank" rel="noopener noreferrer">{p.url}</a>
                <button className="copy-btn" onClick={() => handleCopy(p.url, p.port)}>
                  {copied === p.port ? '已复制' : '复制'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="card-meta">
            {!isOnline && service.expectedPorts?.length > 0 && (
              <span>预期端口: {service.expectedPorts.join(', ')}</span>
            )}
          </div>

          {isOnline && service.url && (
            <div className="card-url">
              <a href={service.url} target="_blank" rel="noopener noreferrer">
                {service.url}
              </a>
              <button className="copy-btn" onClick={() => handleCopy(service.url, service.port)}>
                {copied === service.port ? '已复制' : '复制'}
              </button>
            </div>
          )}
        </>
      )}

      <div className="card-actions">
        {isOnline ? (
          <>
            {isMultiPort ? (
              openPort?.url && (
                <a href={openPort.url} target="_blank" rel="noopener noreferrer" className="btn primary">
                  打开
                </a>
              )
            ) : (
              service.url && (
                <a href={service.url} target="_blank" rel="noopener noreferrer" className="btn primary">
                  打开
                </a>
              )
            )}
            {onStop && (
              <button
                className="btn stop"
                disabled={actionLoading}
                onClick={() => handleAction('stop', onStop)}
              >
                {actionLoading === 'stop' ? '停止中...' : '停止'}
              </button>
            )}
            {onRestart && (
              <button
                className="btn restart"
                disabled={actionLoading}
                onClick={() => handleAction('restart', onRestart)}
              >
                {actionLoading === 'restart' ? '重启中...' : '重启'}
              </button>
            )}
            {onDelete && (
              <button
                className="btn delete"
                disabled={actionLoading}
                onClick={() => handleAction('delete', onDelete)}
              >
                {actionLoading === 'delete' ? '删除中...' : '删除'}
              </button>
            )}
          </>
        ) : (
          <>
            {onStart && hasStartCommand && (
              <button
                className="btn start"
                disabled={actionLoading}
                onClick={() => handleAction('start', onStart)}
              >
                {actionLoading === 'start' ? '启动中...' : '启动'}
              </button>
            )}
            {onRestart && (
              <button
                className="btn restart"
                disabled={actionLoading}
                onClick={() => handleAction('restart', onRestart)}
              >
                {actionLoading === 'restart' ? '重启中...' : '重启'}
              </button>
            )}
            {onDelete && (
              <button
                className="btn delete"
                disabled={actionLoading}
                onClick={() => handleAction('delete', onDelete)}
              >
                {actionLoading === 'delete' ? '删除中...' : '删除'}
              </button>
            )}
          </>
        )}
      </div>

      {actionError && (
        <div className="card-error">{actionError}</div>
      )}
    </div>
  );
}
