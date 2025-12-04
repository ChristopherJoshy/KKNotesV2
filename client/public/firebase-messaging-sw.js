// Firebase Cloud Messaging Service Worker
// Production-ready implementation for KKNotes
// Version: 2.1.0 - Mobile notification fixes

// ==================== SERVICE WORKER CONFIGURATION ====================

const SW_VERSION = '2.1.0';
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

// Default icon - using SVG which works on most modern browsers
const DEFAULT_ICON = '/icon-192x192.svg';
const DEFAULT_BADGE = '/favicon-32.svg';

// Notification styles for different types
const NOTIFICATION_STYLES = {
  submission_pending: { 
    title: '⏳ Submission Pending', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'submission-pending',
    requireInteraction: false
  },
  submission_approved: { 
    title: '✅ Submission Approved!', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'submission-approved',
    requireInteraction: true
  },
  submission_rejected: { 
    title: '❌ Submission Rejected', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'submission-rejected',
    requireInteraction: true
  },
  content_rated: { 
    title: '⭐ New Rating!', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'content-rated',
    requireInteraction: false
  },
  content_reported: { 
    title: '⚠️ Content Report', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'content-reported',
    requireInteraction: true
  },
  pending_approval: { 
    title: '📋 New Approval Request', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'pending-approval',
    requireInteraction: true
  },
  admin_content_added: { 
    title: '📚 New Content Available!', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'admin-content',
    requireInteraction: false
  },
  content_approved: { 
    title: '✅ New Content!', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'content-approved',
    requireInteraction: false
  },
  admin_added: { 
    title: '👤 New Admin Added', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'admin-added',
    requireInteraction: false
  },
  admin_removed: { 
    title: '👤 Admin Removed', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'admin-removed',
    requireInteraction: false
  },
  report_reviewed: { 
    title: '🛡️ Report Reviewed', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: 'report-reviewed',
    requireInteraction: false
  },
  default: { 
    title: '🔔 KKNotes Update', 
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
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

// Track if we've already shown a notification for a message to avoid duplicates
const shownNotifications = new Set();

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Received background message:', payload);
    
    try {
      const data = payload.data || {};
      const notification = payload.notification || {};
      
      // Create unique ID for this message to prevent duplicate notifications
      const messageId = `${data.type || 'default'}-${data.timestamp || Date.now()}`;
      
      // Skip if already shown (can happen when both push and onBackgroundMessage fire)
      if (shownNotifications.has(messageId)) {
        console.log('[FCM-SW] Notification already shown, skipping');
        return;
      }
      shownNotifications.add(messageId);
      
      // Clean up old entries after 1 minute
      setTimeout(() => shownNotifications.delete(messageId), 60000);
      
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
        icon: DEFAULT_ICON,
        badge: DEFAULT_BADGE
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
          '/icon-192x192.svg',
          '/favicon-32.svg'
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

// This handles raw push events - critical for mobile browsers
// Some mobile browsers may not use onBackgroundMessage properly
self.addEventListener('push', (event) => {
  console.log('[FCM-SW] Push event received');
  
  // Always show a notification for push events
  const showNotification = async () => {
    let payload = null;
    let title = '🔔 KKNotes Update';
    let body = 'You have a new notification';
    let data = {};
    
    try {
      if (event.data) {
        payload = event.data.json();
        console.log('[FCM-SW] Push payload:', payload);
        
        // Handle FCM format (notification + data)
        const notification = payload.notification || {};
        const payloadData = payload.data || {};
        
        title = notification.title || payloadData.title || title;
        body = notification.body || payloadData.message || body;
        
        const type = payloadData.type || 'default';
        const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.default;
        
        data = {
          url: payloadData.url || '/',
          type: type,
          contentId: payloadData.contentId,
          contentType: payloadData.contentType,
          timestamp: Date.now(),
          sw_version: SW_VERSION
        };
        
        // Use style-specific settings
        return self.registration.showNotification(title, {
          body: body,
          icon: style.icon,
          badge: style.badge,
          tag: `${style.tag}-${Date.now()}`,
          vibrate: [100, 50, 100],
          requireInteraction: style.requireInteraction,
          silent: false,
          renotify: true,
          data: data,
          actions: getNotificationActions(type)
        });
      }
    } catch (error) {
      console.error('[FCM-SW] Error processing push payload:', error);
    }
    
    // Fallback notification if parsing failed or no data
    return self.registration.showNotification(title, {
      body: body,
      icon: DEFAULT_ICON,
      badge: DEFAULT_BADGE,
      tag: `kknotes-notification-${Date.now()}`,
      vibrate: [100, 50, 100],
      data: { url: '/', timestamp: Date.now() }
    });
  };
  
  event.waitUntil(showNotification());
});

// ==================== ERROR HANDLING ====================

self.addEventListener('error', (event) => {
  console.error('[FCM-SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[FCM-SW] Unhandled promise rejection:', event.reason);
});

console.log('[FCM-SW] Service worker loaded (v' + SW_VERSION + ')');
