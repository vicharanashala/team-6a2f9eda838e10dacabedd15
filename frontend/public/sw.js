const CACHE_NAME = 'prashnasarathi-pwa-cache-1781002837315';
const DATA_CACHE_NAME = 'prashnasarathi-data-cache-1781002837315';

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
  "/_next/static/chunks/fd9d1056-9c032a99761d0a80.js",
  "/_next/static/chunks/117-656b1ecbbc6b8fe3.js",
  "/_next/static/chunks/main-app-93478cfe1e7432fc.js",
  "/_next/static/chunks/app/_not-found/page-1058117207c51285.js",
  "/_next/static/css/cb4471978a6a03b5.css",
  "/_next/static/chunks/648-0fe88ef03a8e9843.js",
  "/_next/static/chunks/859-e1bca3dc8b4a0525.js",
  "/_next/static/chunks/324-26954518a83876c7.js",
  "/_next/static/chunks/689-dae23ab7fcb269ae.js",
  "/_next/static/chunks/180-ae226dde440fde50.js",
  "/_next/static/chunks/750-ca62a9aa6d2ed07e.js",
  "/_next/static/chunks/app/layout-1d61d8d25fe5ba3f.js",
  "/_next/static/chunks/2bfc466f-47019a40064a549f.js",
  "/_next/static/chunks/147-f45f1800405fce62.js",
  "/_next/static/chunks/app/auth/page-cad4c585cdc71c82.js",
  "/_next/static/chunks/app/downloads/page-c1dfa542d7436702.js",
  "/_next/static/chunks/17-4f268eecf486ce8d.js",
  "/_next/static/chunks/app/faqs/page-620c42501e04faaa.js",
  "/_next/static/chunks/app/admin/page-12119c7b36a3a159.js",
  "/_next/static/chunks/668-5acdeb7c3274ff95.js",
  "/_next/static/chunks/app/faqs/[slug]/page-9e97131fa8f1186d.js",
  "/_next/static/chunks/app/guidelines/page-d57936132754e5f7.js",
  "/_next/static/chunks/793-593a48dea3ea6a9a.js",
  "/_next/static/chunks/app/page-60e035bd1b0cf811.js",
  "/_next/static/chunks/app/notifications/page-52e19cf206857a2a.js",
  "/_next/static/chunks/app/questions/ask/page-27d6c22404c4a096.js",
  "/_next/static/chunks/app/questions/[id]/page-c8bb66d83d9273af.js",
  "/_next/static/chunks/413-45c508201d91cf36.js",
  "/_next/static/chunks/app/questions/page-9dc4f714a5ab5299.js",
  "/_next/static/chunks/app/search/page-bda47bc7d28f4be4.js",
  "/_next/static/chunks/app/tags/[name]/page-95061f15406bd5b7.js",
  "/_next/static/chunks/app/saved/page-3c1b2d9edd0562de.js",
  "/_next/static/chunks/app/tags/page-45d63daa4360c6aa.js",
  "/_next/static/chunks/app/users/[username]/page-fe5b48715ffd752b.js",
  "/_next/static/chunks/app/users/page-12d5407eb652b662.js",
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

  // Skip invalid schemes (like chrome-extension://, extension://, file://, data:)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip non-GET requests, socket.io connections, Next.js HMR, and binary app installer files
  if (
    request.method !== 'GET' || 
    url.pathname.startsWith('/downloads/') || 
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.includes('webpack-hmr') ||
    url.pathname.includes('hot-update')
  ) {
    return;
  }

  // Handle API Requests (FAQs, search, categories, user details, etc.)
  if (url.pathname.startsWith('/api/')) {
    // Bypass service worker entirely for AI generation/synthesis requests to avoid timeout aborts or stale cache fallbacks
    if (url.pathname.includes('/search/ai')) {
      return;
    }

    event.respondWith(
      fetchWithTimeout(request, 3000)
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
          // Offline fallback: try to match exactly. DO NOT use ignoreSearch: true here to avoid serving stale, incorrect data for search queries or paginated lists.
          return caches.match(request);
        })
    );
    return;
  }

  // Handle HTML document requests (Navigation) - Network-First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(request, 5000) // 5 seconds is safer for slow connections/cold boots
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
          // Serve the actual cached site page, or fallback to offline.html directly
          // Do NOT fallback to '/' which triggers Next.js client-side chunk loading and crashes when offline.
          return caches.match(request).then((res) => {
            if (res) return res;
            return caches.match('/offline.html');
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
      icon: data.icon || '/logo.png',
      badge: data.badge || '/pwa/icons/icon-72x72.png',
      tag: data.tag || 'notification',
      data: data.data || {},
      requireInteraction: false,
      silent: false,
    };

    event.waitUntil(
      Promise.all([
        // Show the OS banner
        self.registration.showNotification(title, options),
        // Notify all open page clients so they can show an in-app toast instantly
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({
              type: 'PUSH_RECEIVED',
              title: title,
              message: options.body,
            });
          });
        }),
      ])
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
