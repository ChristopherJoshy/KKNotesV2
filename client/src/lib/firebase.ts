import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// FCM VAPID key for web push - must match server configuration
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BIWt-uVrufpuhAlGMo3JZw-ZkiJ1mIFrMqe2zModpFsclumO45KnbVZdQAzFJkMWF8Dfy-AmtoD2OEf5wS6ZXS8';

// Service worker path for FCM
const FCM_SW_PATH = '/firebase-messaging-sw.js';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

export let messaging: Messaging | null = null;
let messagingInitialized = false;
let messagingInitPromise: Promise<Messaging | null> | null = null;

/**
 * Initialize Firebase Cloud Messaging
 * Returns a singleton instance of the messaging object
 */
export async function initializeMessaging(): Promise<Messaging | null> {
  // Return existing instance if already initialized
  if (messagingInitialized && messaging) {
    return messaging;
  }
  
  // Return pending promise if initialization is in progress
  if (messagingInitPromise) {
    return messagingInitPromise;
  }
  
  messagingInitPromise = (async () => {
    try {
      // Check if messaging is supported in this browser
      const supported = await isSupported();
      if (!supported) {
        console.warn('[FCM] Firebase Messaging not supported in this browser');
        return null;
      }
      
      // Check for service worker support
      if (!('serviceWorker' in navigator)) {
        console.warn('[FCM] Service Worker not supported');
        return null;
      }
      
      messaging = getMessaging(app);
      messagingInitialized = true;
      console.log('[FCM] Firebase Messaging initialized');
      return messaging;
    } catch (error) {
      console.error('[FCM] Error initializing messaging:', error);
      return null;
    }
  })();
  
  return messagingInitPromise;
}

/**
 * Get service worker registration for FCM
 */
async function getFCMServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    // Try to get existing registration first
    let registration = await navigator.serviceWorker.getRegistration(FCM_SW_PATH);
    
    if (!registration) {
      // Register the FCM service worker
      console.log('[FCM] Registering service worker...');
      registration = await navigator.serviceWorker.register(FCM_SW_PATH, {
        scope: '/',
      });
    }
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    
    return registration;
  } catch (error) {
    console.error('[FCM] Error getting service worker registration:', error);
    return undefined;
  }
}

/**
 * Request permission and get FCM token for push notifications
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const msg = await initializeMessaging();
    if (!msg) {
      console.warn('[FCM] Messaging not available');
      return null;
    }

    // Check notification permission
    if (Notification.permission === 'denied') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }

    // Request notification permission if not granted
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[FCM] Notification permission not granted');
        return null;
      }
    }

    // Get service worker registration
    const registration = await getFCMServiceWorkerRegistration();
    if (!registration) {
      console.warn('[FCM] Service worker registration not available');
      return null;
    }

    // Get FCM token with VAPID key and service worker
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.warn('[FCM] No token available - check FCM configuration');
      return null;
    }
  } catch (error: any) {
    // Handle specific FCM errors
    if (error?.code === 'messaging/permission-blocked') {
      console.warn('[FCM] Notifications blocked by user');
    } else if (error?.code === 'messaging/unsupported-browser') {
      console.warn('[FCM] Browser does not support FCM');
    } else {
      console.error('[FCM] Error getting token:', error);
    }
    return null;
  }
}

/**
 * Subscribe to FCM messages when app is in foreground
 */
export function onFCMMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messaging) {
    console.warn('[FCM] Messaging not initialized for onMessage');
    return null;
  }

  return onMessage(messaging, (payload) => {
    console.log('[FCM] Message received in foreground:', payload);
    callback(payload);
  });
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFCM(userId: string): Promise<boolean> {
  try {
    const token = await getFCMToken();
    if (!token) return true; // Already unsubscribed
    
    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token })
    });
    
    return response.ok;
  } catch (error) {
    console.error('[FCM] Error unsubscribing:', error);
    return false;
  }
}

// Auto-initialize messaging when module loads (non-blocking)
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      // Delay initialization to not block page load
      setTimeout(() => {
        initializeMessaging().catch(console.error);
      }, 1000);
    }
  });
}

export default app;
