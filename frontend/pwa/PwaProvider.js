'use client';
import { useEffect } from 'react';
import { registerServiceWorker } from './pwaRegister';

export default function PwaProvider({ children }) {
  useEffect(() => {
    // Register PWA service worker on mount
    registerServiceWorker();

    // Global link interceptor when offline to force hard navigation
    const handleOfflineClicks = (e) => {
      if (typeof window !== 'undefined' && !navigator.onLine) {
        const link = e.target.closest('a');
        if (link) {
          const href = link.getAttribute('href');
          if (href && (href.startsWith('/') || href.startsWith(window.location.origin)) && !href.includes('#')) {
            e.preventDefault();
            console.log('[PWA] Offline navigation detected. Forcing hard load for:', href);
            window.location.href = href;
          }
        }
      }
    };

    document.addEventListener('click', handleOfflineClicks, true);

    // Silent pre-fetch of core API endpoints to populate SW data cache if online
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
      
      const timer = setTimeout(() => {
        coreApis.forEach(url => {
          fetch(url).catch(() => {});
        });
      }, 2000);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleOfflineClicks, true);
      };
    }

    return () => {
      document.removeEventListener('click', handleOfflineClicks, true);
    };
  }, []);

  return (
    <>
      {children}
    </>
  );
}
