const CACHE_NAME = 'prashnasarathi-pwa-cache-v8';
const DATA_CACHE_NAME = 'prashnasarathi-data-cache-v8';

// Helper to fetch with a timeout fallback
function fetchWithTimeout(request, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Network timeout'));
    }, timeout);

    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Static files to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/faqs',
  '/questions',
  '/guidelines',
  '/notifications',
  '/saved',
  '/search',
  '/tags',
  '/users',
  '/logo.png',
  '/pwa/icons/icon-72x72.png',
  '/pwa/icons/icon-96x96.png',
  '/pwa/icons/icon-128x128.png',
  '/pwa/icons/icon-144x144.png',
  '/pwa/icons/icon-152x152.png',
  '/pwa/icons/icon-192x192.png',
  '/pwa/icons/icon-384x384.png',
  '/pwa/icons/icon-512x512.png',
  '/favicon.ico',
  '/icon.png'
];

// Install Event: Cache static assets individually to prevent single-failure halts
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
          console.log(`[Service Worker] Successfully pre-cached: ${asset}`);
        } catch (err) {
          console.warn(`[Service Worker] Failed to pre-cache asset during install: ${asset}. Error:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache-first for static/Next.js files, Network-First (with timeout) for API calls
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API Requests (FAQs, search, categories, user details, etc.)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetchWithTimeout(request, 1000)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: try to match exactly, then try with ignoreSearch
          return caches.match(request).then((res) => {
            if (res) return res;
            return caches.match(request, { ignoreSearch: true, cacheName: DATA_CACHE_NAME });
          });
        })
    );
    return;
  }

  // Handle HTML document requests (Navigation) - Network-First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Serve the actual cached site page, home shell, or offline fallback page
          return caches.match(request).then((res) => {
            if (res) return res;
            return caches.match('/', { ignoreSearch: true }).then((homeRes) => {
              if (homeRes) return homeRes;
              return caches.match('/offline.html');
            });
          });
        })
    );
    return;
  }

  // Handle static assets (JS chunks, CSS, images, etc.) - Cache-First
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          const requestUrl = new URL(request.url);
          const isSameOrigin = requestUrl.origin === self.location.origin;
          if (!response || response.status !== 200 || (!isSameOrigin && response.type !== 'basic')) {
            return response;
          }

          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(() => {
          // Return a network error response so the browser handles it as a standard fetch failure (ChunkLoadError)
          return Response.error();
        });
    })
  );
});

// Push Notification Listeners
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'PrashnaSārathi';
    const options = {
      body: data.body || '',
      icon: data.icon || '/icon.png',
      badge: data.badge || '/badge.png',
      tag: data.tag || 'notification',
      data: data.data || {},
      requireInteraction: false,
      silent: false,
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[Service Worker] Error displaying push notification:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link;
  if (link) {
    event.waitUntil(
      clients.openWindow(link)
    );
  } else {
    event.waitUntil(
      clients.openWindow('/notifications')
    );
  }
});
