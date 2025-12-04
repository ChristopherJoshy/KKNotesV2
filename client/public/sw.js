// Import Firebase scripts for FCM in service worker
// Using latest compatible Firebase SDK version
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_NAME = 'kknotes-v2-cache-v6';

// Initialize Firebase in the service worker with full config
// These values must match the client-side Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDSzgYbLym_x8DomEuOVVCeA4thW48IdGs",
  authDomain: "kknotesadvanced.firebaseapp.com",
  projectId: "kknotesadvanced",
  storageBucket: "kknotesadvanced.firebasestorage.app",
  messagingSenderId: "388227934488",
  appId: "1:388227934488:web:76d3d4117fac37ef26566d",
  databaseURL: "https://kknotesadvanced-default-rtdb.firebaseio.com"
};

// Initialize Firebase - handle potential reinitialization gracefully
let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('[SW] Firebase Messaging initialized successfully');
} catch (error) {
  // App might already be initialized
  if (error.code === 'app/duplicate-app') {
    messaging = firebase.messaging();
    console.log('[SW] Firebase Messaging reused existing app');
  } else {
    console.error('[SW] Firebase Messaging initialization failed:', error);
  }
}

// Only cache static assets that won't change often
const urlsToCache = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Helper: detect development (localhost or 127.0.0.1)
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Install event
self.addEventListener('install', (event) => {
  // Always skip waiting to ensure latest service worker is active
  event.waitUntil(
    (async () => {
      if (!IS_DEV) {
        const cache = await caches.open(CACHE_NAME);
        // Only cache external resources, not app code
        await cache.addAll(urlsToCache).catch(err => {
          console.warn('Failed to cache some resources:', err);
        });
      }
      await self.skipWaiting();
    })()
  );
});

// Fetch event - Network first strategy to avoid stale content
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests except for fonts/icons we cache
  const url = new URL(event.request.url);
  const isExternalCached = urlsToCache.some(cachedUrl => event.request.url.startsWith(cachedUrl.split('?')[0]));
  
  if (url.origin !== self.location.origin && !isExternalCached) {
    return;
  }
  
  // In development, always use network
  if (IS_DEV) {
    return;
  }

  // For HTML requests (navigation), always use network first
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For JS/CSS bundles, use network first with cache fallback
  if (event.request.destination === 'script' || event.request.destination === 'style') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Don't cache if not successful
          if (!response || response.status !== 200) {
            return response;
          }
          // Clone and cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For external cached resources (fonts, icons), use cache first
  if (isExternalCached) {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) return response;
        return fetch(event.request).then(fetchResponse => {
          if (fetchResponse && fetchResponse.status === 200) {
            const clone = fetchResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return fetchResponse;
        });
      })
    );
    return;
  }
  
  // For other requests, just use network
  return;
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
  admin_content_added: {
    title: '📚 New Content Available!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  content_approved: {
    title: '✅ New Content!',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  admin_added: {
    title: '👤 New Admin Added',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  admin_removed: {
    title: '👤 Admin Removed',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  report_reviewed: {
    title: '🛡️ Report Reviewed',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  admin_content_deleted: {
    title: '🗑️ Content Deleted',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  admin_scheme_created: {
    title: '📋 New Scheme Created',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  admin_subject_added: {
    title: '📁 Subject Added',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  admin_subject_deleted: {
    title: '📁 Subject Deleted',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  content_deleted: {
    title: '🗑️ Your Content Was Removed',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  },
  default: {
    title: '🔔 KKNotes Update',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png'
  }
};

// Push notification event with rich styling (for web-push fallback)
self.addEventListener('push', (event) => {
  let data = { type: 'default', message: 'New update available!', url: '/', title: null };
  
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    data.message = event.data ? event.data.text() : 'New notes available!';
  }

  const style = NOTIFICATION_STYLES[data.type] || NOTIFICATION_STYLES.default;
  // Use title from data if provided, otherwise use style default
  const notificationTitle = data.title || style.title;
  
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
    self.registration.showNotification(notificationTitle, options)
  );
});

// Handle FCM background messages
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM] Received background message:', payload);
    
    const notificationData = payload.data || {};
    const notification = payload.notification || {};
    
    const type = notificationData.type || 'default';
    const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.default;
    
    const notificationTitle = notification.title || notificationData.title || style.title;
    const notificationBody = notification.body || notificationData.message || 'You have a new notification';
    
    const notificationOptions = {
      body: notificationBody,
      icon: style.icon,
      badge: style.badge,
      vibrate: [100, 50, 100, 50, 100],
      tag: type + '-' + Date.now(),
      renotify: true,
      requireInteraction: type === 'pending_approval',
      data: {
        url: notificationData.url || '/',
        type: type,
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

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn('[SW] Firebase Messaging not available, background messages will not be handled');
}

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
