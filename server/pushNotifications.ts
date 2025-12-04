import { ref, get, set, push, remove } from 'firebase/database';

// ==================== PRODUCTION CONFIGURATION ====================

// Firebase Cloud Messaging VAPID Key for Web Push
const FCM_VAPID_PUBLIC_KEY = process.env.VITE_FIREBASE_VAPID_KEY || 'BIWt-uVrufpuhAlGMo3JZw-ZkiJ1mIFrMqe2zModpFsclumO45KnbVZdQAzFJkMWF8Dfy-AmtoD2OEf5wS6ZXS8';

// Firebase Project ID for FCM v1 API
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'kknotesadvanced';

// FCM HTTP v1 API endpoint
const FCM_V1_URL = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

// Service Account credentials for FCM v1 API (individual env vars)
const FIREBASE_SA_CLIENT_EMAIL = process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL;
const FIREBASE_SA_PRIVATE_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

// ==================== PRODUCTION CONSTANTS ====================

// Token expiry threshold (30 days in milliseconds)
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum retry attempts for FCM API calls
const MAX_RETRY_ATTEMPTS = 3;

// Base delay for exponential backoff (in milliseconds)
const RETRY_BASE_DELAY_MS = 1000;

// Maximum concurrent FCM requests
const MAX_CONCURRENT_REQUESTS = 50;

// Timeout for FCM API calls (in milliseconds)
const FCM_TIMEOUT_MS = 30000;

// OAuth2 token cache
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

// ==================== LOGGING UTILITIES ====================

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const currentLogLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;

function log(level: LogLevel, prefix: string, message: string, data?: any) {
  if (level < currentLogLevel) return;
  
  const timestamp = new Date().toISOString();
  const logFn = level === LogLevel.ERROR ? console.error : 
                level === LogLevel.WARN ? console.warn : console.log;
  
  if (data) {
    logFn(`[${timestamp}] ${prefix} ${message}`, data);
  } else {
    logFn(`[${timestamp}] ${prefix} ${message}`);
  }
}

const fcmLog = {
  debug: (msg: string, data?: any) => log(LogLevel.DEBUG, '[FCM]', msg, data),
  info: (msg: string, data?: any) => log(LogLevel.INFO, '[FCM]', msg, data),
  warn: (msg: string, data?: any) => log(LogLevel.WARN, '[FCM]', msg, data),
  error: (msg: string, data?: any) => log(LogLevel.ERROR, '[FCM]', msg, data),
};

// ==================== RETRY UTILITIES ====================

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for exponential backoff with jitter
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // Add random jitter up to 1 second
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(status: number, errorCode?: string): boolean {
  // Retry on server errors (5xx), rate limiting (429), and timeout
  if (status >= 500 || status === 429 || status === 408) {
    return true;
  }
  
  // Retry on certain FCM error codes
  const retryableCodes = ['UNAVAILABLE', 'INTERNAL', 'QUOTA_EXCEEDED'];
  if (errorCode && retryableCodes.includes(errorCode)) {
    return true;
  }
  
  return false;
}

/**
 * Get OAuth2 access token for FCM v1 API using service account
 * Implements caching and automatic refresh
 */
async function getAccessToken(): Promise<string | null> {
  // Return cached token if still valid (with 5 minute buffer)
  if (cachedAccessToken && Date.now() < tokenExpiry - 300000) {
    return cachedAccessToken;
  }
  
  try {
    // Check if service account credentials are configured
    if (!FIREBASE_SA_CLIENT_EMAIL || !FIREBASE_SA_PRIVATE_KEY) {
      return null;
    }
    
    // Create JWT for OAuth2 token request
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour
    
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };
    
    const payload = {
      iss: FIREBASE_SA_CLIENT_EMAIL,
      sub: FIREBASE_SA_CLIENT_EMAIL,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };
    
    // Base64URL encode
    const base64url = (obj: any) => {
      const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
      return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };
    
    const headerB64 = base64url(header);
    const payloadB64 = base64url(payload);
    const signatureInput = `${headerB64}.${payloadB64}`;
    
    // Sign with private key
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(FIREBASE_SA_PRIVATE_KEY, 'base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    const jwt = `${signatureInput}.${signature}`;
    
    // Exchange JWT for access token with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        fcmLog.error('OAuth2 token error:', { status: tokenResponse.status, error });
        return null;
      }
      
      const tokenData = await tokenResponse.json();
      cachedAccessToken = tokenData.access_token;
      tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
      
      fcmLog.info('OAuth2 access token obtained successfully');
      return cachedAccessToken;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      fcmLog.error('OAuth2 token request timed out');
    } else {
      fcmLog.error('Error getting access token:', error.message);
    }
    return null;
  }
}

// Check if FCM is properly configured
const isFCMConfigured = (): boolean => {
  return !!(FIREBASE_SA_CLIENT_EMAIL && FIREBASE_SA_PRIVATE_KEY);
};

// ==================== TYPE DEFINITIONS ====================

// FCM token storage structure
export interface StoredFCMToken {
  id: string;
  userId: string;
  token: string;
  createdAt: number;
  updatedAt?: number;
  userAgent?: string;
  lastUsed?: number;
  failureCount?: number;
}

export interface PushNotificationPayload {
  type: string;
  title: string;
  message: string;
  url?: string;
  contentId?: string;
  contentType?: string;
}

export interface FCMSendResult {
  success: boolean;
  shouldRemoveToken: boolean;
  error?: string;
  retryable?: boolean;
}

export interface PushStats {
  sent: number;
  failed: number;
  removed: number;
  retried?: number;
}

/**
 * Get the public VAPID key for FCM client subscription
 */
export function getVapidPublicKey(): string {
  return FCM_VAPID_PUBLIC_KEY;
}

// Flag to track if we've already logged the FCM warning
let fcmWarningLogged = false;

/**
 * Send FCM message using the HTTP v1 API with retry logic
 * Implements exponential backoff for retryable errors
 */
async function sendFCMMessage(
  token: string,
  payload: PushNotificationPayload,
  attempt: number = 0
): Promise<FCMSendResult> {
  // Check if FCM is properly configured
  if (!isFCMConfigured()) {
    // Log only once per session to avoid spam
    if (!fcmWarningLogged) {
      fcmLog.warn('Push notifications disabled: Service account not configured');
      fcmLog.warn('To enable push notifications, set these environment variables:');
      fcmLog.warn('  FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL=<service account email>');
      fcmLog.warn('  FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY=<private key>');
      fcmWarningLogged = true;
    }
    return { success: false, shouldRemoveToken: false, error: 'FCM not configured', retryable: false };
  }

  try {
    // Get OAuth2 access token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      fcmLog.error('Failed to get access token');
      return { success: false, shouldRemoveToken: false, error: 'Failed to get access token', retryable: true };
    }

    // FCM v1 API message format
    // IMPORTANT: For mobile/PWA, we use data-only messages so the service worker handles display
    const message = {
      message: {
        token: token,
        // Notification payload for display when app is in background
        notification: {
          title: payload.title,
          body: payload.message,
        },
        // Web push specific options
        webpush: {
          notification: {
            title: payload.title,
            body: payload.message,
            icon: '/icon-192x192.svg',
            badge: '/favicon-32.svg',
            requireInteraction: payload.type === 'pending_approval',
            // Vibration pattern for mobile
            vibrate: [100, 50, 100],
          },
          fcm_options: {
            link: payload.url || '/',
          },
          headers: {
            'TTL': '86400', // 24 hours
            'Urgency': payload.type === 'pending_approval' ? 'high' : 'normal',
          },
        },
        // Data payload - always delivered to service worker
        data: {
          type: payload.type,
          title: payload.title,
          message: payload.message,
          url: payload.url || '/',
          contentId: payload.contentId || '',
          contentType: payload.contentType || '',
          timestamp: Date.now().toString(),
        },
        // Android-specific options for better mobile support
        android: {
          priority: 'high' as const,
          ttl: '86400s',
          notification: {
            channelId: 'kknotes_default',
            priority: 'high' as const,
            defaultVibrateTimings: true,
            defaultSound: true,
          },
        },
        // APNs options for iOS (if using capacitor/native wrapper)
        apns: {
          headers: {
            'apns-priority': '10',
          },
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.message,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      },
    };

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FCM_TIMEOUT_MS);

    try {
      const response = await fetch(FCM_V1_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorCode = errorData?.error?.details?.[0]?.errorCode || errorData?.error?.code;
        const errorMessage = errorData?.error?.message || response.statusText;
        
        fcmLog.debug(`API error (attempt ${attempt + 1}):`, { status: response.status, error: errorMessage });
        
        // Check for invalid token errors (v1 API error codes)
        const invalidTokenErrors = [
          'UNREGISTERED',
          'INVALID_ARGUMENT',
          'NOT_FOUND',
        ];
        
        if (errorCode && invalidTokenErrors.some(e => String(errorMessage).includes(e) || errorCode === e)) {
          fcmLog.info(`Invalid token detected: ${errorMessage}`);
          return { success: false, shouldRemoveToken: true, error: errorMessage, retryable: false };
        }
        
        // Auth errors - don't remove token, might be temporary
        if (response.status === 401 || response.status === 403) {
          // Clear cached token to force refresh
          cachedAccessToken = null;
          tokenExpiry = 0;
          
          // Retry if we haven't exceeded max attempts
          if (attempt < MAX_RETRY_ATTEMPTS) {
            const delay = getBackoffDelay(attempt);
            fcmLog.debug(`Auth error, retrying after ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
            await sleep(delay);
            return sendFCMMessage(token, payload, attempt + 1);
          }
          
          return { success: false, shouldRemoveToken: false, error: 'Authentication error', retryable: true };
        }
        
        // Check if error is retryable
        if (isRetryableError(response.status, errorCode) && attempt < MAX_RETRY_ATTEMPTS) {
          const delay = getBackoffDelay(attempt);
          fcmLog.debug(`Retryable error, retrying after ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
          await sleep(delay);
          return sendFCMMessage(token, payload, attempt + 1);
        }
        
        return { success: false, shouldRemoveToken: false, error: errorMessage, retryable: isRetryableError(response.status, errorCode) };
      }

      const result = await response.json();
      fcmLog.debug('Message sent successfully:', { messageId: result.name });
      return { success: true, shouldRemoveToken: false };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      fcmLog.warn('FCM request timed out');
      
      // Retry on timeout
      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = getBackoffDelay(attempt);
        fcmLog.debug(`Timeout, retrying after ${delay}ms (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        await sleep(delay);
        return sendFCMMessage(token, payload, attempt + 1);
      }
      
      return { success: false, shouldRemoveToken: false, error: 'Request timed out', retryable: true };
    }
    
    fcmLog.error('Error sending message:', error.message);
    return { success: false, shouldRemoveToken: false, error: String(error), retryable: true };
  }
}

/**
 * Save an FCM token for a user (prevents duplicates by token)
 * Production-ready with proper error handling and deduplication
 */
export async function savePushSubscription(
  database: any,
  userId: string,
  token: string,
  userAgent?: string
): Promise<string> {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    if (!token || typeof token !== 'string' || token.length < 100) {
      throw new Error('Invalid FCM token');
    }
    
    // First check if this token already exists for this user to prevent duplicates
    const userTokensRef = ref(database, `fcmTokens/${userId}`);
    const snapshot = await get(userTokensRef);
    const existingData = snapshot.val();
    
    if (existingData) {
      for (const [tokenId, tokenData] of Object.entries(existingData as Record<string, any>)) {
        if (tokenData?.token === token) {
          // Update existing token instead of creating duplicate
          const updateData = {
            token,
            createdAt: tokenData.createdAt || Date.now(),
            updatedAt: Date.now(),
            lastUsed: Date.now(),
            userAgent: userAgent ? userAgent.substring(0, 500) : tokenData.userAgent,
            failureCount: 0, // Reset failure count on re-registration
          };
          
          await set(ref(database, `fcmTokens/${userId}/${tokenId}`), updateData);
          fcmLog.debug(`Updated existing FCM token for user: ${userId.substring(0, 8)}...`);
          return tokenId;
        }
      }
      
      // Check if user has too many tokens (limit to 10 devices)
      const tokenCount = Object.keys(existingData).length;
      if (tokenCount >= 10) {
        // Remove oldest token
        const oldest = Object.entries(existingData as Record<string, any>)
          .sort((a, b) => (a[1]?.lastUsed || a[1]?.createdAt || 0) - (b[1]?.lastUsed || b[1]?.createdAt || 0))[0];
        if (oldest) {
          await remove(ref(database, `fcmTokens/${userId}/${oldest[0]}`));
          fcmLog.debug(`Removed oldest token for user ${userId.substring(0, 8)}... to make room`);
        }
      }
    }
    
    // Create new token if no duplicate found
    const tokenRef = push(ref(database, `fcmTokens/${userId}`));
    const tokenData = {
      token,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      userAgent: userAgent ? userAgent.substring(0, 500) : undefined,
      failureCount: 0,
    };
    
    await set(tokenRef, tokenData);
    fcmLog.info(`Created new FCM token for user: ${userId.substring(0, 8)}...`);
    return tokenRef.key!;
  } catch (error: any) {
    fcmLog.error('Error saving FCM token:', error.message);
    throw error;
  }
}

/**
 * Remove an FCM token
 */
export async function removePushSubscription(
  database: any,
  userId: string,
  token: string
): Promise<void> {
  try {
    if (!userId || !token) {
      fcmLog.warn('Invalid removePushSubscription parameters');
      return;
    }
    
    const userTokensRef = ref(database, `fcmTokens/${userId}`);
    const snapshot = await get(userTokensRef);
    const data = snapshot.val();

    if (data) {
      for (const [tokenId, tokenData] of Object.entries(data as Record<string, any>)) {
        if (tokenData?.token === token) {
          await remove(ref(database, `fcmTokens/${userId}/${tokenId}`));
          fcmLog.info(`Removed FCM token for user: ${userId.substring(0, 8)}...`);
          return;
        }
      }
    }
    
    fcmLog.debug(`Token not found for removal: ${userId.substring(0, 8)}...`);
  } catch (error: any) {
    fcmLog.error('Error removing FCM token:', error.message);
    throw error;
  }
}

/**
 * Remove a token by its ID directly
 */
async function removeTokenById(
  database: any,
  userId: string,
  tokenId: string
): Promise<void> {
  try {
    await remove(ref(database, `fcmTokens/${userId}/${tokenId}`));
    fcmLog.debug(`Removed invalid FCM token ${tokenId.substring(0, 8)}... for user ${userId.substring(0, 8)}...`);
  } catch (error: any) {
    fcmLog.error('Error removing token by ID:', error.message);
  }
}

/**
 * Update token failure count with automatic cleanup
 */
async function incrementTokenFailure(
  database: any,
  userId: string,
  tokenId: string,
  currentFailures: number
): Promise<void> {
  try {
    const newFailureCount = (currentFailures || 0) + 1;
    
    // Remove token after 5 consecutive failures
    if (newFailureCount >= 5) {
      await removeTokenById(database, userId, tokenId);
      fcmLog.info(`Removed token after ${newFailureCount} failures`);
      return;
    }
    
    await set(ref(database, `fcmTokens/${userId}/${tokenId}/failureCount`), newFailureCount);
  } catch (error: any) {
    fcmLog.error('Error updating token failure count:', error.message);
  }
}

/**
 * Reset token failure count on successful send
 */
async function resetTokenFailure(
  database: any,
  userId: string,
  tokenId: string
): Promise<void> {
  try {
    const updates = {
      [`fcmTokens/${userId}/${tokenId}/lastUsed`]: Date.now(),
      [`fcmTokens/${userId}/${tokenId}/failureCount`]: 0,
    };
    
    // Use individual sets for compatibility
    await set(ref(database, `fcmTokens/${userId}/${tokenId}/lastUsed`), Date.now());
    await set(ref(database, `fcmTokens/${userId}/${tokenId}/failureCount`), 0);
  } catch (error: any) {
    // Non-critical error, just log
    fcmLog.debug('Error resetting token failure count:', error.message);
  }
}

/**
 * Get all FCM tokens for a user with automatic cleanup of expired tokens
 */
export async function getUserFCMTokens(
  database: any,
  userId: string
): Promise<StoredFCMToken[]> {
  try {
    if (!userId) return [];
    
    const userTokensRef = ref(database, `fcmTokens/${userId}`);
    const snapshot = await get(userTokensRef);
    const data = snapshot.val();

    if (!data) {
      return [];
    }

    const tokens: StoredFCMToken[] = [];
    const now = Date.now();
    const cleanupPromises: Promise<void>[] = [];
    
    for (const [tokenId, tokenData] of Object.entries(data as Record<string, any>)) {
      if (tokenData?.token) {
        // Skip expired tokens (older than 30 days without activity)
        const lastActivity = tokenData.lastUsed || tokenData.updatedAt || tokenData.createdAt;
        if (now - lastActivity > TOKEN_EXPIRY_MS) {
          // Clean up expired token asynchronously
          cleanupPromises.push(removeTokenById(database, userId, tokenId));
          continue;
        }
        
        tokens.push({
          id: tokenId,
          userId,
          token: tokenData.token,
          createdAt: tokenData.createdAt || Date.now(),
          updatedAt: tokenData.updatedAt,
          userAgent: tokenData.userAgent,
          lastUsed: tokenData.lastUsed,
          failureCount: tokenData.failureCount || 0,
        });
      }
    }
    
    // Execute cleanup in background (don't await to avoid slowing down the main operation)
    if (cleanupPromises.length > 0) {
      Promise.all(cleanupPromises).catch(err => 
        fcmLog.debug(`Cleanup of ${cleanupPromises.length} expired tokens completed`, err)
      );
    }

    return tokens;
  } catch (error: any) {
    fcmLog.error('Error getting user FCM tokens:', error.message);
    return [];
  }
}

/**
 * Get all FCM tokens from the database with efficient batching
 */
export async function getAllFCMTokens(
  database: any,
  excludeUserId?: string
): Promise<StoredFCMToken[]> {
  try {
    const tokensRef = ref(database, 'fcmTokens');
    const snapshot = await get(tokensRef);
    const data = snapshot.val();

    if (!data) {
      return [];
    }

    const tokens: StoredFCMToken[] = [];
    const now = Date.now();
    const cleanupTasks: Array<{ userId: string; tokenId: string }> = [];
    
    for (const [userId, userTokens] of Object.entries(data as Record<string, any>)) {
      if (excludeUserId && userId === excludeUserId) continue;
      
      if (typeof userTokens === 'object' && userTokens !== null) {
        for (const [tokenId, tokenData] of Object.entries(userTokens as Record<string, any>)) {
          if (tokenData?.token) {
            // Skip expired tokens
            const lastActivity = tokenData.lastUsed || tokenData.updatedAt || tokenData.createdAt;
            if (now - lastActivity > TOKEN_EXPIRY_MS) {
              cleanupTasks.push({ userId, tokenId });
              continue;
            }
            
            tokens.push({
              id: tokenId,
              userId,
              token: tokenData.token,
              createdAt: tokenData.createdAt || Date.now(),
              updatedAt: tokenData.updatedAt,
              userAgent: tokenData.userAgent,
              lastUsed: tokenData.lastUsed,
              failureCount: tokenData.failureCount || 0,
            });
          }
        }
      }
    }
    
    // Batch cleanup of expired tokens in background
    if (cleanupTasks.length > 0) {
      fcmLog.debug(`Cleaning up ${cleanupTasks.length} expired tokens in background`);
      Promise.all(cleanupTasks.map(t => removeTokenById(database, t.userId, t.tokenId)))
        .catch(err => fcmLog.debug('Background cleanup error:', err));
    }

    return tokens;
  } catch (error: any) {
    fcmLog.error('Error getting all FCM tokens:', error.message);
    return [];
  }
}

/**
 * Concurrency limiter for parallel requests
 */
async function limitConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const task of tasks) {
    const p = task().then(result => {
      results.push(result);
    });
    
    const e = p.finally(() => {
      executing.splice(executing.indexOf(e), 1);
    });
    executing.push(e);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}

/**
 * Send push notification to a specific user via FCM
 * Optimized with concurrent device handling
 */
export async function sendPushToUser(
  database: any,
  userId: string,
  payload: PushNotificationPayload
): Promise<PushStats> {
  const stats: PushStats = { sent: 0, failed: 0, removed: 0, retried: 0 };

  try {
    if (!userId) {
      fcmLog.warn('sendPushToUser called without userId');
      return stats;
    }
    
    const tokens = await getUserFCMTokens(database, userId);
    
    if (tokens.length === 0) {
      fcmLog.debug(`No FCM tokens found for user: ${userId.substring(0, 8)}...`);
      return stats;
    }

    fcmLog.info(`Sending push to ${tokens.length} device(s) for user: ${userId.substring(0, 8)}...`);

    // Create tasks for each token
    const tasks = tokens.map(tokenData => async () => {
      const result = await sendFCMMessage(tokenData.token, payload);
      
      if (result.shouldRemoveToken) {
        await removeTokenById(database, userId, tokenData.id);
        return { success: false, removed: true };
      }
      
      if (!result.success) {
        await incrementTokenFailure(database, userId, tokenData.id, tokenData.failureCount || 0);
        return { success: false, removed: false };
      }
      
      // Update lastUsed on successful send
      await resetTokenFailure(database, userId, tokenData.id);
      return { success: true, removed: false };
    });

    // Execute with concurrency limit
    const results = await limitConcurrency(tasks, MAX_CONCURRENT_REQUESTS);

    results.forEach((result) => {
      if (result.success) stats.sent++;
      else if (result.removed) stats.removed++;
      else stats.failed++;
    });

    fcmLog.info(`Push to user ${userId.substring(0, 8)}... complete:`, stats);
    return stats;
  } catch (error: any) {
    fcmLog.error('Error sending push notification to user:', error.message);
    return stats;
  }
}

/**
 * Broadcast push notification to all users via FCM
 * Production-ready with batching, concurrency limits, and progress tracking
 */
export async function broadcastPushNotification(
  database: any,
  payload: PushNotificationPayload,
  excludeUserId?: string
): Promise<PushStats> {
  const stats: PushStats = { sent: 0, failed: 0, removed: 0, retried: 0 };
  const startTime = Date.now();

  try {
    const tokens = await getAllFCMTokens(database, excludeUserId);
    
    if (tokens.length === 0) {
      fcmLog.info('No FCM tokens found for broadcast');
      return stats;
    }

    fcmLog.info(`Broadcasting to ${tokens.length} device(s)`);

    // Process in batches with controlled concurrency
    const BATCH_SIZE = 100;
    const BATCH_DELAY_MS = 100;
    
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(tokens.length / BATCH_SIZE);
      
      fcmLog.debug(`Processing batch ${batchNum}/${totalBatches} (${batch.length} tokens)`);
      
      // Create tasks for batch
      const tasks = batch.map(tokenData => async () => {
        const result = await sendFCMMessage(tokenData.token, payload);
        
        if (result.shouldRemoveToken) {
          await removeTokenById(database, tokenData.userId, tokenData.id);
          return { success: false, removed: true };
        }
        
        if (!result.success) {
          await incrementTokenFailure(database, tokenData.userId, tokenData.id, tokenData.failureCount || 0);
          return { success: false, removed: false };
        }
        
        // Update lastUsed on successful send
        await resetTokenFailure(database, tokenData.userId, tokenData.id);
        return { success: true, removed: false };
      });

      // Execute batch with concurrency limit
      const results = await limitConcurrency(tasks, MAX_CONCURRENT_REQUESTS);

      results.forEach((result) => {
        if (result.success) stats.sent++;
        else if (result.removed) stats.removed++;
        else stats.failed++;
      });
      
      // Small delay between batches to avoid overwhelming FCM
      if (i + BATCH_SIZE < tokens.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const duration = Date.now() - startTime;
    fcmLog.info(`Push broadcast complete in ${duration}ms:`, stats);
    return stats;
  } catch (error: any) {
    fcmLog.error('Error broadcasting push notifications:', error.message);
    return stats;
  }
}

/**
 * Cleanup stale tokens (tokens that haven't been used in 30+ days)
 * Production-ready with batching and progress reporting
 */
export async function cleanupStaleTokens(database: any): Promise<number> {
  let cleaned = 0;
  const startTime = Date.now();
  
  try {
    const tokensRef = ref(database, 'fcmTokens');
    const snapshot = await get(tokensRef);
    const data = snapshot.val();

    if (!data) return 0;

    const now = Date.now();
    const cleanupTasks: Array<{ userId: string; tokenId: string }> = [];
    
    // Collect all stale tokens
    for (const [userId, userTokens] of Object.entries(data as Record<string, any>)) {
      if (typeof userTokens === 'object' && userTokens !== null) {
        for (const [tokenId, tokenData] of Object.entries(userTokens as Record<string, any>)) {
          if (tokenData) {
            const lastActivity = tokenData.lastUsed || tokenData.updatedAt || tokenData.createdAt;
            if (now - lastActivity > TOKEN_EXPIRY_MS) {
              cleanupTasks.push({ userId, tokenId });
            }
          }
        }
      }
    }
    
    if (cleanupTasks.length === 0) {
      fcmLog.debug('No stale tokens found');
      return 0;
    }
    
    fcmLog.info(`Found ${cleanupTasks.length} stale tokens to clean up`);
    
    // Process cleanup in batches
    const CLEANUP_BATCH_SIZE = 50;
    for (let i = 0; i < cleanupTasks.length; i += CLEANUP_BATCH_SIZE) {
      const batch = cleanupTasks.slice(i, i + CLEANUP_BATCH_SIZE);
      
      await Promise.all(batch.map(async ({ userId, tokenId }) => {
        try {
          await removeTokenById(database, userId, tokenId);
          cleaned++;
        } catch (error) {
          // Continue with cleanup even if individual removals fail
        }
      }));
      
      // Small delay between batches
      if (i + CLEANUP_BATCH_SIZE < cleanupTasks.length) {
        await sleep(50);
      }
    }
    
    const duration = Date.now() - startTime;
    fcmLog.info(`Cleaned up ${cleaned} stale FCM tokens in ${duration}ms`);
    
    return cleaned;
  } catch (error: any) {
    fcmLog.error('Error cleaning up stale tokens:', error.message);
    return cleaned;
  }
}

// ==================== EXPORTS ====================

export default {
  getVapidPublicKey,
  broadcastPushNotification,
  sendPushToUser,
  savePushSubscription,
  removePushSubscription,
  getUserFCMTokens,
  getAllFCMTokens,
  cleanupStaleTokens,
};
