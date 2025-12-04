// Firebase Cloud Messaging Service Worker
// This file is the entry point for Firebase Cloud Messaging
// It imports and extends the main service worker functionality

// Import Firebase scripts for FCM
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

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

// Initialize Firebase
let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
  console.log('[FCM-SW] Firebase Messaging initialized');
} catch (error) {
  if (error.code === 'app/duplicate-app') {
    messaging = firebase.messaging();
  } else {
    console.error('[FCM-SW] Firebase initialization error:', error);
  }
}

// Notification styles for different types
const NOTIFICATION_STYLES = {
  submission_pending: { title: '⏳ Submission Pending', icon: '/icon-192x192.png' },
  submission_approved: { title: '✅ Submission Approved!', icon: '/icon-192x192.png' },
  submission_rejected: { title: '❌ Submission Rejected', icon: '/icon-192x192.png' },
  content_rated: { title: '⭐ New Rating!', icon: '/icon-192x192.png' },
  content_reported: { title: '⚠️ Content Report', icon: '/icon-192x192.png' },
  pending_approval: { title: '📋 New Approval Request', icon: '/icon-192x192.png' },
  admin_content_added: { title: '📚 New Content Available!', icon: '/icon-192x192.png' },
  content_approved: { title: '✅ New Content!', icon: '/icon-192x192.png' },
  admin_added: { title: '👤 New Admin Added', icon: '/icon-192x192.png' },
  admin_removed: { title: '👤 Admin Removed', icon: '/icon-192x192.png' },
  report_reviewed: { title: '🛡️ Report Reviewed', icon: '/icon-192x192.png' },
  default: { title: '🔔 KKNotes Update', icon: '/icon-192x192.png' }
};

// Handle background messages
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Received background message:', payload);
    
    const data = payload.data || {};
    const notification = payload.notification || {};
    const type = data.type || 'default';
    const style = NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.default;
    
    const notificationTitle = notification.title || data.title || style.title;
    const notificationBody = notification.body || data.message || 'You have a new notification';
    
    const options = {
      body: notificationBody,
      icon: style.icon,
      badge: '/badge-72x72.png',
      tag: `${type}-${Date.now()}`,
      vibrate: [100, 50, 100],
      requireInteraction: type === 'pending_approval',
      data: {
        url: data.url || '/',
        type: type,
        timestamp: Date.now()
      },
      actions: [
        { action: 'view', title: '👀 View' },
        { action: 'dismiss', title: '✕ Close' }
      ]
    };
    
    return self.registration.showNotification(notificationTitle, options);
  });
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.focus();
            if (url !== '/') client.navigate(url);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});
