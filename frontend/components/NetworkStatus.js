'use client';
import { useState, useEffect } from 'react';

export default function NetworkStatus() {
  const [status, setStatus] = useState('good'); // 'good' | 'slow' | 'offline'

  useEffect(() => {
    const checkNetwork = () => {
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }

      // Check using Network Information API
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        const type = conn.effectiveType;
        if (type === '2g' || type === '3g' || conn.rtt > 1500 || conn.downlink < 0.5) {
          setStatus('slow');
          return;
        }
      }
      setStatus('good');
    };

    checkNetwork();

    window.addEventListener('online', checkNetwork);
    window.addEventListener('offline', checkNetwork);

    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
      conn.addEventListener('change', checkNetwork);
    }

    // Dynamic latency check: Ping backend to detect high network latency
    const interval = setInterval(async () => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        // fetch /api/health through our domain
        const res = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        
        const duration = Date.now() - start;
        if (duration > 3000) {
          setStatus('slow');
        } else if (navigator.onLine) {
          const conn2 = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
          if (conn2 && (conn2.effectiveType === '2g' || conn2.effectiveType === '3g')) {
            setStatus('slow');
          } else {
            setStatus('good');
          }
        }
      } catch (err) {
        if (!navigator.onLine) {
          setStatus('offline');
        } else if (err.name === 'AbortError') {
          setStatus('slow');
        }
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', checkNetwork);
      window.removeEventListener('offline', checkNetwork);
      if (conn) {
        conn.removeEventListener('change', checkNetwork);
      }
      clearInterval(interval);
    };
  }, []);

  if (status === 'good') return null;

  return (
    <div className="fixed bottom-24 left-6 z-50 max-w-sm w-full sm:w-auto animate-fade-in-up">
      {status === 'offline' ? (
        <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg border border-red-600 flex items-center gap-3 backdrop-blur-md bg-opacity-95">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg shrink-0">
            🔌
          </div>
          <div>
            <p className="text-xs font-bold">You are offline</p>
            <p className="text-[10px] text-red-100">Check your internet connection.</p>
          </div>
        </div>
      ) : (
        <div className="bg-amber-500 text-amber-950 px-4 py-3 rounded-xl shadow-lg border border-amber-600 flex items-center gap-3 backdrop-blur-md bg-opacity-95">
          <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-lg shrink-0 animate-pulse">
            ⚠️
          </div>
          <div>
            <p className="text-xs font-bold">Network connection is slow</p>
            <p className="text-[10px] text-amber-900 leading-snug">
              The network in your area is low. Please be patient or move to an area with good network.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
