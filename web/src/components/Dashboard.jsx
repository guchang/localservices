import { useState, useEffect, useCallback } from 'react';
import ServiceCard from './ServiceCard.jsx';
import RegisterModal from './RegisterModal.jsx';
import RegisterPromptModal from './RegisterPromptModal.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';

export default function Dashboard() {
  const [services, setServices] = useState([]);
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 });
  const [showRegister, setShowRegister] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const wsUrl = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
  const { subscribe } = useWebSocket(wsUrl);

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      setServices(data.services || []);
      setSummary(data.summary || { total: 0, online: 0, offline: 0 });
    } catch {}
  }, []);

  useEffect(() => {
    fetchServices();
    const unsub = subscribe((msg) => {
      if (msg.type === 'full_state') {
        setServices(msg.data.services || []);
        setSummary(msg.data.summary || { total: 0, online: 0, offline: 0 });
      } else if (msg.type === 'status_change') {
        fetchServices();
      }
    });
    return unsub;
  }, [fetchServices, subscribe]);

  const handleRegister = async (project) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '注册失败');
    }
    fetchServices();
  };

  const online = services.filter(s => s.status === 'online');
  const offline = services.filter(s => s.status === 'offline');

  const handleStart = async (serviceId) => {
    const res = await fetch(`/api/services/${serviceId}/start`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '启动失败');
    }
    fetchServices();
  };

  const handleStop = async (serviceId) => {
    const res = await fetch(`/api/services/${serviceId}/stop`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '停止失败');
    }
    fetchServices();
  };

  const handleRestart = async (serviceId) => {
    const res = await fetch(`/api/services/${serviceId}/restart`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '重启失败');
    }
    fetchServices();
  };

  const handleDelete = async (serviceId) => {
    const res = await fetch(`/api/projects/${serviceId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '删除失败');
    }
    const data = await res.json();
    setServices(data.services?.services || []);
    setSummary(data.services?.summary || { total: 0, online: 0, offline: 0 });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>LocalServiceHub</h1>
          <div className="summary">
            <span><span className="dot online" /> {summary.online} 在线</span>
            <span><span className="dot offline" /> {summary.offline} 离线</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setShowPrompt(true)}>注册提示词</button>
          <button className="btn" onClick={() => setShowRegister(true)}>手动注册</button>
        </div>
      </header>

      {online.length > 0 && (
        <div className="section-title">
          <span className="dot online" /> 在线服务
        </div>
      )}
      <div className="grid">
        {online.map(s => <ServiceCard key={s.id} service={s} onStop={handleStop} onRestart={handleRestart} onDelete={handleDelete} />)}
      </div>

      {offline.length > 0 && (
        <div className="section-title">
          <span className="dot offline" /> 离线项目
        </div>
      )}
      <div className="grid">
        {offline.map(s => <ServiceCard key={s.id} service={s} onStart={handleStart} onRestart={handleRestart} onDelete={handleDelete} />)}
      </div>

      {services.length === 0 && (
        <div className="empty">
          <p>未发现服务。点击「注册提示词」或「手动注册」添加项目。</p>
        </div>
      )}

      {showRegister && (
        <RegisterModal onClose={() => setShowRegister(false)} onSubmit={handleRegister} />
      )}

      {showPrompt && (
        <RegisterPromptModal onClose={() => setShowPrompt(false)} />
      )}
    </div>
  );
}
