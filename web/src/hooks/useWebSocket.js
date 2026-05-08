import { useRef, useEffect, useCallback, useState } from 'react';

export function useWebSocket(url) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Set());

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };
    ws.onerror = () => ws.close();

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        for (const fn of listenersRef.current) fn(msg);
      } catch {}
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  return { connected, subscribe };
}
