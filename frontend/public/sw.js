const CACHE_NAME = 'prashnasarathi-pwa-cache-v12';
const DATA_CACHE_NAME = 'prashnasarathi-data-cache-v12';

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
  "/",
  "/offline.html",
  "/faqs",
  "/questions",
  "/guidelines",
  "/notifications",
  "/saved",
  "/search",
  "/tags",
  "/users",
  "/logo.png",
  "/pwa/icons/icon-72x72.png",
  "/pwa/icons/icon-96x96.png",
  "/pwa/icons/icon-128x128.png",
  "/pwa/icons/icon-144x144.png",
  "/pwa/icons/icon-152x152.png",
  "/pwa/icons/icon-192x192.png",
  "/pwa/icons/icon-384x384.png",
  "/pwa/icons/icon-512x512.png",
  "/favicon.ico",
  "/icon.png",
  "/api/faqs?limit=100",
  "/api/questions?page=1&sort=newest",
  "/api/questions?page=1&sort=active",
  "/api/questions?page=1&sort=votes",
  "/api/questions?page=1&sort=liked",
  "/api/questions?page=1&sort=views",
  "/api/recommendations/recommended?page=1&limit=20",
  "/_next/static/chunks/webpack-8e941cbaca64cb4f.js",
  "/_next/static/chunks/fd9d1056-5d3ffa4d5e6942ae.js",
  "/_next/static/chunks/117-f5f2e51ba9a400df.js",
  "/_next/static/chunks/main-app-93478cfe1e7432fc.js",
  "/_next/static/chunks/app/_not-found/page-7ea4ef5f72bbb012.js",
  "/_next/static/css/6fbba5492ef16f90.css",
  "/_next/static/chunks/648-699c09fb2d2c7e31.js",
  "/_next/static/chunks/859-53653f498c829bbc.js",
  "/_next/static/chunks/680-2921ecdb664d2cf7.js",
  "/_next/static/chunks/689-dae23ab7fcb269ae.js",
  "/_next/static/chunks/180-ae226dde440fde50.js",
  "/_next/static/chunks/750-63a907bd63f8553c.js",
  "/_next/static/chunks/app/layout-f3b0fe56552b9eee.js",
  "/_next/static/chunks/2bfc466f-47019a40064a549f.js",
  "/_next/static/chunks/147-f45f1800405fce62.js",
  "/_next/static/chunks/app/auth/page-45252ac1840cdf08.js",
  "/_next/static/chunks/app/downloads/page-02728a1e91a865e1.js",
  "/_next/static/chunks/app/admin/page-9568a7340ad54dd7.js",
  "/_next/static/chunks/17-d0bf48d9ef10df88.js",
  "/_next/static/chunks/app/faqs/page-55b928c3c6c09e97.js",
  "/_next/static/chunks/668-5335dfa152ed9336.js",
  "/_next/static/chunks/app/faqs/[slug]/page-33b5d19e83c703a7.js",
  "/_next/static/chunks/app/page-8081f9d2a9eb13cc.js",
  "/_next/static/chunks/app/search/page-8f2fe109a3ed8215.js",
  "/_next/static/chunks/app/saved/page-2f705b1a08dc82e8.js",
  "/_next/static/chunks/app/questions/[id]/page-be99ea00bd0aeaa7.js",
  "/_next/static/chunks/app/guidelines/page-6ce6118f1a2d3170.js",
  "/_next/static/chunks/app/questions/ask/page-5fe4257ef8559020.js",
  "/_next/static/chunks/413-b1f6270b2b1a22f6.js",
  "/_next/static/chunks/app/tags/[name]/page-7dd4ba9af9fe402f.js",
  "/_next/static/chunks/app/questions/page-799ad849fbb9827f.js",
  "/_next/static/chunks/app/notifications/page-4965801e90deee80.js",
  "/_next/static/chunks/app/tags/page-68f59bc9f4ace876.js",
  "/_next/static/chunks/app/users/[username]/page-206e66b1e7b6042c.js",
  "/_next/static/chunks/app/users/page-786e9096d98b8aff.js",
  "/_next/static/chunks/framework-f66176bb897dc684.js",
  "/_next/static/chunks/main-a895a058bfcf6af5.js",
  "/_next/static/chunks/pages/_app-72b849fbd24ac258.js",
  "/_next/static/chunks/pages/_error-7ba65e1336b92748.js",
  "/_next/static/chunks/polyfills-42372ed130431b0a.js"
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

  // Skip non-GET requests and skip binary app installer files from caching
  if (request.method !== 'GET' || url.pathname.startsWith('/downloads/')) {
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
      fetchWithTimeout(request, 1500)
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

  const targetUrl = event.notification.data?.link 
    ? new URL(event.notification.data.link, self.location.origin).href
    : new URL('/notifications', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            try {
              client.navigate(targetUrl);
            } catch (_) {}
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
