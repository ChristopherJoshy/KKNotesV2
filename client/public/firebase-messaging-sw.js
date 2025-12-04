// Firebase Cloud Messaging Service Worker
// Production-ready implementation for KKNotes
// Version: 2.0.0

// ==================== SERVICE WORKER CONFIGURATION ====================

const SW_VERSION = '2.0.0';
const CACHE_NAME = `kknotes-fcm-v${SW_VERSION}`;

// Import Firebase scripts for FCM
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ==================== FIREBASE CONFIGURATION ====================

// Firebase configuration - must match client config
const firebaseConfig = {
  apiKey: "AIzaSyDSzgYbLym_x8DomEuOVVCeA4thW48IdGs",
  authDomain: "kknotesadvanced.firebaseapp.com",
  projectId: "kknotesadvanced",
  storageBucket: "kknotesadvanced.firebasestorage.app",
  messagingSenderId: "388227934488",
  appId: "1:388227934488:web:76d3d4117fac37ef26566d",
  databaseURL: "https://kknotesadvanced-default-rtdb.firebaseio.com"
};

// ==================== NOTIFICATION STYLES ====================

// Notification styles for different types
const NOTIFICATION_STYLES = {
  submission_pending: { 
    title: '⏳ Submission Pending', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'submission-pending',
    requireInteraction: false
  },
  submission_approved: { 
    title: '✅ Submission Approved!', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'submission-approved',
    requireInteraction: true
  },
  submission_rejected: { 
    title: '❌ Submission Rejected', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'submission-rejected',
    requireInteraction: true
  },
  content_rated: { 
    title: '⭐ New Rating!', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'content-rated',
    requireInteraction: false
  },
  content_reported: { 
    title: '⚠️ Content Report', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'content-reported',
    requireInteraction: true
  },
  pending_approval: { 
    title: '📋 New Approval Request', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'pending-approval',
    requireInteraction: true
  },
  admin_content_added: { 
    title: '📚 New Content Available!', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'admin-content',
    requireInteraction: false
  },
  content_approved: { 
    title: '✅ New Content!', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'content-approved',
    requireInteraction: false
  },
  admin_added: { 
    title: '👤 New Admin Added', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'admin-added',
    requireInteraction: false
  },
  admin_removed: { 
    title: '👤 Admin Removed', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'admin-removed',
    requireInteraction: false
  },
  report_reviewed: { 
    title: '🛡️ Report Reviewed', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'report-reviewed',
    requireInteraction: false
  },
  default: { 
    title: '🔔 KKNotes Update', 
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'kknotes-notification',
    requireInteraction: false
  }
};

// ==================== FIREBASE INITIALIZATION ====================

let messaging = null;
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  try {
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
    firebaseInitialized = true;
    console.log('[FCM-SW] Firebase Messaging initialized (v' + SW_VERSION + ')');
  } catch (error) {
    if (error.code === 'app/duplicate-app') {
      messaging = firebase.messaging();
      firebaseInitialized = true;
    } else {
      console.error('[FCM-SW] Firebase initialization error:', error);
    }
  }
}

// Initialize on load
initializeFirebase();

// ==================== BACKGROUND MESSAGE HANDLER ====================

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Received background message:', payload);
    
    try {
      const data = payload.data || {};
      const notification = payload.notification || {};
      const type = data.type || 'default';
      const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.default;
      
      const notificationTitle = notification.title || data.title || style.title;
      const notificationBody = notification.body || data.message || 'You have a new notification';
      
      const options = {
        body: notificationBody,
        icon: style.icon,
        badge: style.badge,
        tag: `${style.tag}-${Date.now()}`,
        vibrate: [100, 50, 100],
        requireInteraction: style.requireInteraction,
        silent: false,
        renotify: true,
        data: {
          url: data.url || '/',
          type: type,
          contentId: data.contentId,
          contentType: data.contentType,
          timestamp: Date.now(),
          sw_version: SW_VERSION
        },
        actions: getNotificationActions(type)
      };
      
      return self.registration.showNotification(notificationTitle, options);
    } catch (error) {
      console.error('[FCM-SW] Error processing background message:', error);
      
      // Fallback notification
      return self.registration.showNotification('KKNotes', {
        body: 'You have a new notification',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      });
    }
  });
}

// ==================== NOTIFICATION ACTIONS ====================

function getNotificationActions(type) {
  switch (type) {
    case 'pending_approval':
      return [
        { action: 'review', title: '📋 Review' },
        { action: 'dismiss', title: '✕ Later' }
      ];
    case 'submission_approved':
    case 'submission_rejected':
      return [
        { action: 'view', title: '👀 View Details' },
        { action: 'dismiss', title: '✕ Close' }
      ];
    default:
      return [
        { action: 'view', title: '👀 View' },
        { action: 'dismiss', title: '✕ Close' }
      ];
  }
}

// ==================== NOTIFICATION CLICK HANDLER ====================

self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification clicked:', event.action, event.notification.data);
  
  // Close the notification
  event.notification.close();
  
  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }
  
  // Determine URL to open
  const data = event.notification.data || {};
  let url = data.url || '/';
  
  // Special handling for review action
  if (event.action === 'review' && data.type === 'pending_approval') {
    url = '/admin?tab=pending';
  }
  
  // Open or focus the app window
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    }).then((clientList) => {
      // Check if there's already an open window
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          // Focus existing window and navigate
          return client.focus().then((focusedClient) => {
            if (focusedClient && url !== '/') {
              return focusedClient.navigate(url);
            }
            return focusedClient;
          });
        }
      }
      
      // No existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }).catch((error) => {
      console.error('[FCM-SW] Error handling notification click:', error);
    })
  );
});

// ==================== NOTIFICATION CLOSE HANDLER ====================

self.addEventListener('notificationclose', (event) => {
  console.log('[FCM-SW] Notification closed:', event.notification.data);
  
  // Track notification dismissal if needed
  const data = event.notification.data || {};
  
  // Could send analytics here if needed
});

// ==================== SERVICE WORKER LIFECYCLE ====================

self.addEventListener('install', (event) => {
  console.log('[FCM-SW] Installing service worker v' + SW_VERSION);
  
  // Skip waiting to activate immediately
  event.waitUntil(
    Promise.all([
      self.skipWaiting(),
      // Pre-cache essential assets
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll([
          '/icon-192x192.png',
          '/badge-72x72.png'
        ]).catch((error) => {
          console.warn('[FCM-SW] Cache pre-fetch failed:', error);
        });
      })
    ])
  );
});

self.addEventListener('activate', (event) => {
  console.log('[FCM-SW] Activating service worker v' + SW_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Take control of all clients
      self.clients.claim(),
      
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('kknotes-fcm-') && name !== CACHE_NAME)
            .map((name) => {
              console.log('[FCM-SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
    ])
  );
});

// ==================== PUSH EVENT HANDLER (FALLBACK) ====================

self.addEventListener('push', (event) => {
  console.log('[FCM-SW] Push event received');
  
  // This is a fallback handler - FCM usually handles push via onBackgroundMessage
  // But we handle it here too for robustness
  
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[FCM-SW] Push payload:', payload);
      
      // If FCM handled it, skip
      if (payload.notification && messaging) {
        return;
      }
      
      // Show notification for data-only messages
      const data = payload.data || payload;
      const type = data.type || 'default';
      const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.default;
      
      event.waitUntil(
        self.registration.showNotification(data.title || style.title, {
          body: data.message || data.body || 'You have a new notification',
          icon: style.icon,
          badge: style.badge,
          tag: `${style.tag}-${Date.now()}`,
          data: {
            url: data.url || '/',
            type: type,
            timestamp: Date.now()
          }
        })
      );
    } catch (error) {
      console.error('[FCM-SW] Error processing push event:', error);
    }
  }
});

// ==================== ERROR HANDLING ====================

self.addEventListener('error', (event) => {
  console.error('[FCM-SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[FCM-SW] Unhandled promise rejection:', event.reason);
});

console.log('[FCM-SW] Service worker loaded (v' + SW_VERSION + ')');
