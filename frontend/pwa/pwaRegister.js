export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  // Skip service worker registration in development mode to prevent HMR and hot-reloading cache glitches
  if (process.env.NODE_ENV === 'development') {
    console.log('[PWA] Service Worker registration skipped in development mode.');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
          console.log('[PWA] Unregistered service worker found in development mode.');
        }
      });
    }
    return;
  }

  if ('serviceWorker' in navigator) {
    const register = () => {
      const swUrl = '/sw.js';
      
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
          registration.update();
          
          if ('Notification' in window && Notification.permission === 'default') {
            console.log('[PWA] Push notification support available.');
          }
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
    }
  }
}
