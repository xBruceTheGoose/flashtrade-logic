/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

// Precache all assets marked by vite
precacheAndRoute(self.__WB_MANIFEST);

// Cache the API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 5, // 5 minutes
      }),
    ],
  })
);

// Cache blockchain RPC responses
registerRoute(
  ({ url }) => url.pathname.includes('eth-mainnet.alchemyapi.io') ||
               url.pathname.includes('polygon-mainnet.g.alchemy.com'),
  new CacheFirst({
    cacheName: 'blockchain-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30, // 30 seconds max age for blockchain data
      }),
    ],
  })
);

// Cache static assets
registerRoute(
  ({ request }) => request.destination === 'style' ||
                   request.destination === 'script' ||
                   request.destination === 'image',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// Offline fallback
const offlineFallbackPage = '/offline.html';
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL(offlineFallbackPage),
    {
      denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
    }
  )
);

// Handle blockchain data sync
let pendingTransactions: Set<string> = new Set();

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  const transactions = Array.from(pendingTransactions);
  for (const txHash of transactions) {
    try {
      const response = await fetch('/api/transactions/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txHash }),
      });

      if (response.ok) {
        pendingTransactions.delete(txHash);
      }
    } catch (error) {
      console.error('Failed to sync transaction:', txHash, error);
    }
  }
}

// Handle push notifications for important events
self.addEventListener('push', (event) => {
  const data = event.data?.json();
  
  const options = {
    body: data.body,
    icon: '/icons/notification-icon.png',
    badge: '/icons/badge-icon.png',
    data: {
      url: data.url,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Background sync for offline trades
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trades') {
    event.waitUntil(syncOfflineTrades());
  }
});

async function syncOfflineTrades() {
  const offlineDb = await openOfflineDb();
  const trades = await offlineDb
    .transaction('trades')
    .objectStore('trades')
    .getAll();

  for (const trade of trades) {
    try {
      const response = await fetch('/api/trades/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trade),
      });

      if (response.ok) {
        await offlineDb
          .transaction('trades', 'readwrite')
          .objectStore('trades')
          .delete(trade.id);
      }
    } catch (error) {
      console.error('Failed to sync trade:', trade.id, error);
    }
  }
}

async function openOfflineDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('OfflineTradeDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore('trades', { keyPath: 'id' });
    };
  });
}

// Periodic background sync for market data
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-market-data') {
    event.waitUntil(updateMarketData());
  }
});

async function updateMarketData() {
  try {
    const response = await fetch('/api/market/data');
    if (response.ok) {
      const cache = await caches.open('market-data');
      await cache.put('/api/market/data', response);
    }
  } catch (error) {
    console.error('Failed to update market data:', error);
  }
}
