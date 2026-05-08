import { useRef, useEffect, useCallback, useState } from 'react';

export function useWebSocket(url) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef(new Set());
  const cleanedRef = useRef(false);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      if (!cleanedRef.current) {
        setTimeout(connect, 3000);
      }
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
    cleanedRef.current = false;
    connect();
    return () => {
      cleanedRef.current = true;
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  return { connected, subscribe };
}
