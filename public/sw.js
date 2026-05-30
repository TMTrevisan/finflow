const CACHE_NAME = 'finflow-cache-v1';
const CONFIG_CACHE = 'finflow-config';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => {
      console.warn('Service Worker cache installation skipped (storage blocked):', err);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== CONFIG_CACHE) {
            return caches.delete(key).catch(() => {});
          }
        })
      );
    }).catch(err => {
      console.warn('Service Worker cache activation cleanup skipped (storage blocked):', err);
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network-First for HTML/navigation requests to prevent cached index.html from fetching dead hashed assets
  const isNavigation = e.request.mode === 'navigate' || 
                       e.request.url === self.location.origin || 
                       e.request.url === self.location.origin + '/' ||
                       e.request.url.endsWith('/index.html');

  if (isNavigation) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(e.request, networkResponse.clone()))
              .catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(e.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // Stale-While-Revalidate for other static assets
  e.respondWith(
    caches.match(e.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          fetch(e.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(e.request, networkResponse))
                .catch(() => {});
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(e.request);
      })
      .catch((err) => {
        // Fall back to direct network request if caches API throws access denied
        return fetch(e.request);
      })
  );
});

// Helpers to save and retrieve settings in Cache Storage safely (handling sandboxed restriction errors)
const saveApiUrl = async (url) => {
  try {
    const cache = await caches.open(CONFIG_CACHE);
    await cache.put('/api-url', new Response(url));
  } catch (err) {
    console.warn('Cache storage is not allowed/accessible in this context:', err);
  }
};

const getApiUrl = async () => {
  try {
    const cache = await caches.open(CONFIG_CACHE);
    const response = await cache.match('/api-url');
    return response ? response.text() : '';
  } catch (err) {
    console.warn('Cache storage read failed (access denied):', err);
    return '';
  }
};

// Listen for settings synchronization messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_API_URL') {
    event.waitUntil(saveApiUrl(event.data.url));
  }
});

// Background sync execution
const checkNewTransactionsAndNotify = async () => {
  const url = await getApiUrl();
  if (!url) return;

  try {
    const res = await fetch(url);
    if (!res.ok) return;

    const data = await res.json();
    const transactions = data.transactions || [];

    // Filter uncategorized expenses/income
    const uncategorized = transactions.filter(t => 
      !t.category || t.category.toLowerCase().trim() === 'uncategorized'
    );

    if (uncategorized.length > 0) {
      let configCache;
      let lastTxnId = '';
      try {
        configCache = await caches.open(CONFIG_CACHE);
        const lastTxnIdRes = await configCache.match('/last-notified-id');
        lastTxnId = lastTxnIdRes ? await lastTxnIdRes.text() : '';
      } catch (cacheErr) {
        console.warn('Notification configCache access failed:', cacheErr);
      }

      // Check if the latest uncategorized transaction is new
      const latestTxn = uncategorized[0];
      if (latestTxn.id !== lastTxnId) {
        try {
          if (configCache) {
            await configCache.put('/last-notified-id', new Response(latestTxn.id));
          }
        } catch (cachePutErr) {
          console.warn('Failed to save last-notified-id:', cachePutErr);
        }

        self.registration.showNotification('Uncategorized Transactions', {
          body: `You have ${uncategorized.length} transaction(s) requiring category triage.`,
          icon: '/pwa-icon.png',
          badge: '/pwa-icon.png',
          vibrate: [200, 100, 200],
          tag: 'uncategorized-triage',
          data: { url: self.location.origin + '/#transactions' }
        });
      }
    }
  } catch (err) {
    console.error('Service worker background check failed:', err);
  }
};

// Register background periodic sync event listener
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-transactions') {
    event.waitUntil(checkNewTransactionsAndNotify());
  }
});

// Handle notification click redirects
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
