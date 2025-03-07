// Service Worker for caching and offline functionality

const CACHE_NAME = 'flashtrade-cache-v1';
const OFFLINE_URL = '/offline.html';

// Resources to preCache
const PRE_CACHE_RESOURCES = [
  '/',
  '/index.html',
  '/offline.html',
  '/assets/index.css',
  '/assets/index.js',
  '/favicon.ico'
];

// Install event - precache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Pre-caching offline resources');
        return cache.addAll(PRE_CACHE_RESOURCES);
      })
      .then(() => {
        // Skip waiting makes the updated service worker active immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Service Worker: Removing old cache', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Claim clients so the service worker is in control immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache if possible, otherwise fetch and cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Handle API requests differently - don't cache them
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // For HTML requests - try network first, then cache
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request)
            .then(cachedResponse => {
              // If we have a cached version, return it
              if (cachedResponse) {
                return cachedResponse;
              }
              // Otherwise return the offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // For non-HTML requests - try cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached response
          return cachedResponse;
        }
        
        // No cache hit, go to network
        return fetch(event.request)
          .then(response => {
            // Cache the response for future
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            
            // For image requests, return a placeholder
            if (event.request.destination === 'image') {
              return caches.match('/placeholder.svg');
            }
            
            // For other requests, just throw the error
            throw error;
          });
      })
  );
});

// Push event - for notifications
self.addEventListener('push', (event) => {
  let notification = {
    title: 'FlashTrade Update',
    body: 'New content is available',
    icon: '/favicon.ico'
  };
  
  if (event.data) {
    try {
      notification = JSON.parse(event.data.text());
    } catch (e) {
      notification.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      data: notification.data
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(windowClients => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
