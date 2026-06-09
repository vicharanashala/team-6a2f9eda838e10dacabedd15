'use client';
import { useEffect } from 'react';
import { registerServiceWorker } from './pwaRegister';
import AppUpdateChecker from '../components/AppUpdateChecker';

export default function PwaProvider({ children }) {
  useEffect(() => {
    // Register PWA service worker on mount
    registerServiceWorker();

    // Global listener for resource chunk load errors to auto-reload and pull latest build assets
    const handleGlobalError = (event) => {
      const message = event.message || (event.error && event.error.message) || '';
      const isChunkError = 
        message.includes('ChunkLoadError') || 
        message.includes('loading chunk') || 
        (event.target && (event.target.tagName === 'SCRIPT' || event.target.tagName === 'LINK') && (event.target.src || event.target.href)?.includes('/_next/'));

      if (isChunkError) {
        const lastReload = sessionStorage.getItem('last_chunk_error_reload');
        const now = Date.now();
        // Prevent infinite reload loops by allowing at most one reload every 10 seconds
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem('last_chunk_error_reload', now.toString());
          console.warn('[PWA] Global chunk or resource load error detected. Auto-reloading page to get latest version...');
          window.location.reload();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('error', handleGlobalError, true); // Capture phase is critical to catch resource load errors
    }

    // Silent pre-fetch of core API endpoints to populate SW data cache if online
    let timer;
    if (typeof window !== 'undefined' && navigator.onLine) {
      const coreApis = [
        '/api/faqs?limit=100',
        '/api/questions?page=1&sort=newest',
        '/api/questions?page=1&sort=active',
        '/api/questions?page=1&sort=votes',
        '/api/questions?page=1&sort=liked',
        '/api/questions?page=1&sort=views',
        '/api/recommendations/recommended?page=1&limit=20'
      ];
      
      timer = setTimeout(() => {
        coreApis.forEach(url => {
          fetch(url).catch(() => {});
        });
      }, 2000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('error', handleGlobalError, true);
      }
    };
  }, []);

  return (
    <>
      <AppUpdateChecker />
      {children}
    </>
  );
}
