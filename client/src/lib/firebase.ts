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

// FCM VAPID key for web push
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BIWt-uVrufpuhAlGMo3JZw-ZkiJ1mIFrMqe2zModpFsclumO45KnbVZdQAzFJkMWF8Dfy-AmtoD2OEf5wS6ZXS8';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

export let messaging: Messaging | null = null;
let messagingInitialized = false;

// Initialize messaging after checking support
export async function initializeMessaging(): Promise<Messaging | null> {
  if (messagingInitialized && messaging) {
    return messaging;
  }
  
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      messagingInitialized = true;
      console.log('FCM messaging initialized');
      return messaging;
    } else {
      console.log('FCM messaging not supported in this browser');
      return null;
    }
  } catch (error) {
    console.error('Error initializing FCM messaging:', error);
    return null;
  }
}

/**
 * Request permission and get FCM token for push notifications
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const msg = await initializeMessaging();
    if (!msg) {
      console.log('Messaging not available');
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Get FCM token with VAPID key
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.getRegistration(),
    });

    if (token) {
      console.log('FCM token obtained:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.log('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

/**
 * Subscribe to FCM messages when app is in foreground
 */
export function onFCMMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messaging) {
    console.log('Messaging not initialized for onMessage');
    return null;
  }

  return onMessage(messaging, (payload) => {
    console.log('FCM message received in foreground:', payload);
    callback(payload);
  });
}

// Auto-initialize messaging
isSupported().then((supported) => {
  if (supported) {
    initializeMessaging();
  }
});

export default app;
