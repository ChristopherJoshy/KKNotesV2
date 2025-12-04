import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

// ==================== FIREBASE CONFIGURATION ====================

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

// ==================== PRODUCTION CONSTANTS ====================

// Maximum retries for FCM token retrieval
const MAX_TOKEN_RETRIES = 3;

// Delay between retries (in milliseconds)
const TOKEN_RETRY_DELAY = 2000;

// Local storage keys
const LS_FCM_TOKEN_KEY = 'fcm_token';
const LS_FCM_TOKEN_TIMESTAMP_KEY = 'fcm_token_timestamp';

// Token refresh interval (7 days in milliseconds)
const TOKEN_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000;

// ==================== LOGGING UTILITY ====================

const isDev = import.meta.env.DEV;

const fcmLog = {
  debug: (msg: string, data?: any) => isDev && console.log(`[FCM] ${msg}`, data || ''),
  info: (msg: string, data?: any) => console.log(`[FCM] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[FCM] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[FCM] ${msg}`, data || ''),
};

// ==================== FIREBASE INITIALIZATION ====================

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

export let messaging: Messaging | null = null;
let messagingInitialized = false;
let messagingInitPromise: Promise<Messaging | null> | null = null;

/**
 * Sleep utility for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the cached token needs refresh
 */
function shouldRefreshToken(): boolean {
  try {
    const timestamp = localStorage.getItem(LS_FCM_TOKEN_TIMESTAMP_KEY);
    if (!timestamp) return true;
    
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    return tokenAge > TOKEN_REFRESH_INTERVAL;
  } catch {
    return true;
  }
}

/**
 * Cache the FCM token locally
 */
function cacheToken(token: string): void {
  try {
    localStorage.setItem(LS_FCM_TOKEN_KEY, token);
    localStorage.setItem(LS_FCM_TOKEN_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    fcmLog.debug('Failed to cache token:', error);
  }
}

/**
 * Get cached FCM token
 */
function getCachedToken(): string | null {
  try {
    const token = localStorage.getItem(LS_FCM_TOKEN_KEY);
    if (token && !shouldRefreshToken()) {
      return token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear cached FCM token
 */
function clearCachedToken(): void {
  try {
    localStorage.removeItem(LS_FCM_TOKEN_KEY);
    localStorage.removeItem(LS_FCM_TOKEN_TIMESTAMP_KEY);
  } catch {
    // Ignore errors
  }
}

// ==================== FIREBASE CLOUD MESSAGING ====================

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
      // Check if running in a browser environment
      if (typeof window === 'undefined') {
        fcmLog.warn('Not in browser environment');
        return null;
      }
      
      // Check if messaging is supported in this browser
      const supported = await isSupported();
      if (!supported) {
        fcmLog.warn('Firebase Messaging not supported in this browser');
        return null;
      }
      
      // Check for service worker support
      if (!('serviceWorker' in navigator)) {
        fcmLog.warn('Service Worker not supported');
        return null;
      }
      
      // Check for notification support
      if (!('Notification' in window)) {
        fcmLog.warn('Notifications not supported');
        return null;
      }
      
      messaging = getMessaging(app);
      messagingInitialized = true;
      fcmLog.info('Firebase Messaging initialized');
      return messaging;
    } catch (error: any) {
      fcmLog.error('Error initializing messaging:', error.message);
      messagingInitPromise = null; // Allow retry
      return null;
    }
  })();
  
  return messagingInitPromise;
}

/**
 * Get service worker registration for FCM
 * Handles registration errors gracefully
 */
async function getFCMServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    // Check if service worker is already registered
    const existingRegistrations = await navigator.serviceWorker.getRegistrations();
    let registration = existingRegistrations.find(reg => 
      reg.active?.scriptURL.includes('firebase-messaging-sw.js')
    );
    
    if (registration) {
      fcmLog.debug('Using existing service worker registration');
      
      // Wait for the service worker to be ready if it's installing
      if (registration.installing || registration.waiting) {
        await new Promise<void>((resolve) => {
          const sw = registration!.installing || registration!.waiting;
          if (!sw) {
            resolve();
            return;
          }
          
          const onStateChange = () => {
            if (sw.state === 'activated') {
              sw.removeEventListener('statechange', onStateChange);
              resolve();
            }
          };
          
          sw.addEventListener('statechange', onStateChange);
          
          // Timeout after 10 seconds
          setTimeout(resolve, 10000);
        });
      }
      
      return registration;
    }
    
    // Register the FCM service worker
    fcmLog.debug('Registering service worker...');
    registration = await navigator.serviceWorker.register(FCM_SW_PATH, {
      scope: '/',
    });
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    fcmLog.info('Service worker registered');
    
    return registration;
  } catch (error: any) {
    fcmLog.error('Error getting service worker registration:', error.message);
    return undefined;
  }
}

/**
 * Request permission and get FCM token for push notifications
 * Production-ready with retry logic and caching
 */
export async function getFCMToken(forceRefresh: boolean = false): Promise<string | null> {
  try {
    // Check for cached token first (unless force refresh)
    if (!forceRefresh) {
      const cachedToken = getCachedToken();
      if (cachedToken) {
        fcmLog.debug('Using cached FCM token');
        return cachedToken;
      }
    }
    
    const msg = await initializeMessaging();
    if (!msg) {
      fcmLog.warn('Messaging not available');
      return null;
    }

    // Check notification permission
    if (Notification.permission === 'denied') {
      fcmLog.warn('Notification permission denied');
      clearCachedToken();
      return null;
    }

    // Request notification permission if not granted
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        fcmLog.warn('Notification permission not granted');
        return null;
      }
    }

    // Get service worker registration
    const registration = await getFCMServiceWorkerRegistration();
    if (!registration) {
      fcmLog.warn('Service worker registration not available');
      return null;
    }

    // Retry logic for getting FCM token
    let lastError: any = null;
    for (let attempt = 0; attempt < MAX_TOKEN_RETRIES; attempt++) {
      try {
        // Get FCM token with VAPID key and service worker
        const token = await getToken(msg, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          fcmLog.info('Token obtained successfully');
          cacheToken(token);
          return token;
        }
      } catch (error: any) {
        lastError = error;
        fcmLog.debug(`Token attempt ${attempt + 1} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error?.code === 'messaging/permission-blocked') {
          fcmLog.warn('Notifications blocked by user');
          return null;
        }
        
        if (error?.code === 'messaging/unsupported-browser') {
          fcmLog.warn('Browser does not support FCM');
          return null;
        }
        
        // Wait before retry
        if (attempt < MAX_TOKEN_RETRIES - 1) {
          await sleep(TOKEN_RETRY_DELAY * (attempt + 1));
        }
      }
    }
    
    // All retries failed
    fcmLog.error('Failed to get token after retries:', lastError?.message);
    return null;
  } catch (error: any) {
    fcmLog.error('Error getting token:', error.message);
    return null;
  }
}

/**
 * Subscribe to FCM messages when app is in foreground
 * Returns cleanup function or null if messaging unavailable
 */
export function onFCMMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messaging) {
    fcmLog.warn('Messaging not initialized for onMessage');
    return null;
  }

  try {
    return onMessage(messaging, (payload) => {
      fcmLog.debug('Message received in foreground:', payload);
      callback(payload);
    });
  } catch (error: any) {
    fcmLog.error('Error setting up message listener:', error.message);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 * Clears local cache and removes token from server
 */
export async function unsubscribeFCM(userId: string): Promise<boolean> {
  try {
    const token = getCachedToken() || await getFCMToken();
    if (!token) {
      clearCachedToken();
      return true; // Already unsubscribed
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      clearCachedToken();
      
      return response.ok;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    fcmLog.error('Error unsubscribing:', error.message);
    clearCachedToken();
    return false;
  }
}

/**
 * Check if FCM is supported and ready
 */
export async function isFCMReady(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator)) return false;
    if (!('Notification' in window)) return false;
    
    const supported = await isSupported();
    if (!supported) return false;
    
    return Notification.permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

// ==================== AUTO-INITIALIZATION ====================

// Auto-initialize messaging when module loads (non-blocking)
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      // Delay initialization to not block page load
      setTimeout(() => {
        initializeMessaging().catch(err => fcmLog.debug('Auto-init failed:', err));
      }, 2000);
    }
  }).catch(() => {
    // Ignore - browser doesn't support FCM
  });
}

export default app;
