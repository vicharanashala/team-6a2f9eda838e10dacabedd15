export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    const register = () => {
      const swUrl = '/sw.js';
      
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
          
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
