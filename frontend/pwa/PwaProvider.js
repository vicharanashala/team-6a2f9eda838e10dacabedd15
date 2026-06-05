'use client';
import { useEffect } from 'react';
import { registerServiceWorker } from './pwaRegister';

export default function PwaProvider({ children }) {
  useEffect(() => {
    // Register PWA service worker on mount
    registerServiceWorker();

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
      
      // Delay slightly to prevent competing with main page loading resources
      const timer = setTimeout(() => {
        coreApis.forEach(url => {
          fetch(url).catch(() => {});
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <>
      {children}
    </>
  );
}
