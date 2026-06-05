const CACHE_NAME = 'prashnasarathi-pwa-cache-v9';
const DATA_CACHE_NAME = 'prashnasarathi-data-cache-v9';

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
  "/_next/static/chunks/webpack-c105cf7135d99ba2.js",
  "/_next/static/chunks/fd9d1056-5d3ffa4d5e6942ae.js",
  "/_next/static/chunks/117-f5f2e51ba9a400df.js",
  "/_next/static/chunks/main-app-93478cfe1e7432fc.js",
  "/_next/static/chunks/app/_not-found/page-7ea4ef5f72bbb012.js",
  "/_next/static/css/11eb44af9cafa651.css",
  "/_next/static/chunks/648-699c09fb2d2c7e31.js",
  "/_next/static/chunks/859-0e34696b8f4645e4.js",
  "/_next/static/chunks/680-2921ecdb664d2cf7.js",
  "/_next/static/chunks/750-aa87a6b99cac7f1e.js",
  "/_next/static/chunks/app/layout-9e196fc6ea039c55.js",
  "/_next/static/chunks/17-415c15461d1f32b5.js",
  "/_next/static/chunks/668-076c07eb97f20bbf.js",
  "/_next/static/chunks/app/faqs/[slug]/page-0c8fc82ba5cc6aea.js",
  "/_next/static/chunks/app/guidelines/page-6ce6118f1a2d3170.js",
  "/_next/static/chunks/app/faqs/page-64ec283ece07d84c.js",
  "/_next/static/chunks/app/admin/page-781b9ea2f9d9320c.js",
  "/_next/static/chunks/app/notifications/page-03d7c50e9eef6809.js",
  "/_next/static/chunks/app/questions/ask/page-1efffafaf42674b0.js",
  "/_next/static/chunks/app/page-180c2ac9be295880.js",
  "/_next/static/chunks/app/questions/[id]/page-a0feffaad8dfa3d4.js",
  "/_next/static/chunks/413-f9337ab567df0720.js",
  "/_next/static/chunks/app/questions/page-85a700f4d7f89287.js",
  "/_next/static/chunks/app/saved/page-9f8bd1089daae08c.js",
  "/_next/static/chunks/app/tags/page-b8943b171b60196c.js",
  "/_next/static/chunks/app/users/page-ab93edd34cadad2f.js",
  "/_next/static/chunks/app/tags/[name]/page-5dd8218d740092cb.js",
  "/_next/static/chunks/2bfc466f-93d62d26a37025c3.js",
  "/_next/static/chunks/147-9e895d8ad76f1a94.js",
  "/_next/static/chunks/app/auth/page-b6fe877b0c9c4fb9.js",
  "/_next/static/chunks/app/search/page-c24df1c188e2d2a8.js",
  "/_next/static/chunks/app/users/[username]/page-9c8a033d0346cad3.js",
  "/_next/static/chunks/framework-f66176bb897dc684.js",
  "/_next/static/chunks/main-fc7aafc368a36ffa.js",
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
