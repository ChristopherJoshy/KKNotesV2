const CACHE_NAME = 'kknotes-v2-cache-v3';
const urlsToCache = [
  '/',
  '/src/main.tsx',
  '/src/index.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Helper: detect development (localhost or 127.0.0.1)
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Install event
self.addEventListener('install', (event) => {
  if (IS_DEV) {
    event.waitUntil(self.skipWaiting());
    return;
  }
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  if (IS_DEV) {
    // In development, do not intercept; always pass-through to network
    return; // not calling respondWith lets the request proceed normally
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request);
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Take control immediately
      await self.clients.claim();
      // Clear all old caches to avoid serving stale modules
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })()
  );
});

// Notification type styles for rich notifications
const NOTIFICATION_STYLES = {
  submission_pending: {
    title: '⏳ Submission Pending',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  submission_approved: {
    title: '✅ Submission Approved!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  submission_rejected: {
    title: '❌ Submission Rejected',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  content_rated: {
    title: '⭐ New Rating!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  content_reported: {
    title: '⚠️ Content Report',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  pending_approval: {
    title: '📋 New Approval Request',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  default: {
    title: '🔔 KKNotes Update',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  }
};

// Push notification event with rich styling
self.addEventListener('push', (event) => {
  let data = { type: 'default', message: 'New update available!', url: '/' };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    data.message = event.data ? event.data.text() : 'New notes available!';
  }

  const style = NOTIFICATION_STYLES[data.type] || NOTIFICATION_STYLES.default;
  
  const options = {
    body: data.message,
    icon: style.icon,
    badge: style.badge,
    vibrate: [100, 50, 100, 50, 100],
    tag: data.type + '-' + Date.now(),
    renotify: true,
    requireInteraction: data.type === 'pending_approval',
    silent: false,
    data: {
      url: data.url || '/',
      type: data.type,
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: '👀 View',
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss',
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(style.title, options)
  );
});

// Notification click event with smart navigation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'dismiss') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.focus();
            // Navigate to the specific URL if needed
            if (url !== '/') {
              client.navigate(url);
            }
            return;
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Background sync for offline note uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle offline functionality here
  console.log('Background sync triggered');
}
