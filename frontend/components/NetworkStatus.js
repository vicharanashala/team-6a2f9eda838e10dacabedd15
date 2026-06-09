'use client';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';


export default function NetworkStatus() {
  const [status, setStatus] = useState('good');
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsDismissed(false);
  }, [status]);

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
        const res = await fetch(`${api.baseUrl}/health`, { signal: controller.signal, cache: 'no-store' });
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
        if (!navigator.onLine || err.message === 'Failed to fetch' || err.name === 'TypeError') {
          setStatus('offline');
        } else if (err.name === 'AbortError') {
          setStatus('slow');
        }
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', checkNetwork);
      window.removeEventListener('offline', checkNetwork);
      if (conn) {
        conn.removeEventListener('change', checkNetwork);
      }
      clearInterval(interval);
    };
  }, []);

  const [isReady, setIsReady] = useState(false);
  const prevStatusRef = useRef(status);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) {
      prevStatusRef.current = status;
      return;
    }

    const statusChanged = prevStatusRef.current !== status;
    prevStatusRef.current = status;

    if (status === 'good' && statusChanged) {
      toast.success('Back online! Live synchronization restored.', {
        id: 'network-status-toast',
        duration: 3500,
        position: 'top-right',
        icon: '⚡'
      });
    }
  }, [status, isReady]);

  if (status === 'good' || isDismissed) return null;

  return (
    <div className="fixed top-16 left-4 right-4 bottom-auto md:top-auto md:bottom-24 md:left-6 md:right-auto z-50 max-w-none md:max-w-sm w-auto animate-fade-in-up">
      {status === 'offline' ? (
        <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg border border-red-600 flex items-center justify-between gap-3 backdrop-blur-md bg-opacity-95">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg shrink-0">
              🔌
            </div>
            <div>
              <p className="text-xs font-bold">You are offline</p>
              <p className="text-[10px] text-red-100">Check your internet connection.</p>
            </div>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-red-100 hover:text-white hover:bg-white/10 rounded-md transition-colors shrink-0"
            title="Dismiss warning"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="bg-amber-500 text-amber-950 px-4 py-3 rounded-xl shadow-lg border border-amber-600 flex items-center justify-between gap-3 backdrop-blur-md bg-opacity-95">
          <div className="flex items-center gap-3">
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
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-amber-900 hover:text-amber-950 hover:bg-black/5 rounded-md transition-colors shrink-0"
            title="Dismiss warning"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
