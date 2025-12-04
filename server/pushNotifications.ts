import { ref, get, set, push, remove } from 'firebase/database';

// Firebase Cloud Messaging VAPID Key for Web Push
const FCM_VAPID_PUBLIC_KEY = process.env.VITE_FIREBASE_VAPID_KEY || 'BIWt-uVrufpuhAlGMo3JZw-ZkiJ1mIFrMqe2zModpFsclumO45KnbVZdQAzFJkMWF8Dfy-AmtoD2OEf5wS6ZXS8';

// Firebase Project ID for FCM v1 API
const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'kknotesadvanced';

// FCM HTTP v1 API endpoint
const FCM_V1_URL = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

// Service Account credentials for FCM v1 API (individual env vars)
const FIREBASE_SA_CLIENT_EMAIL = process.env.FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL;
const FIREBASE_SA_PRIVATE_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

// Token expiry threshold (30 days in milliseconds)
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// OAuth2 token cache
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get OAuth2 access token for FCM v1 API using service account
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
    
    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[FCM] OAuth2 token error:', error);
      return null;
    }
    
    const tokenData = await tokenResponse.json();
    cachedAccessToken = tokenData.access_token;
    tokenExpiry = Date.now() + (tokenData.expires_in * 1000);
    
    console.log('[FCM] OAuth2 access token obtained');
    return cachedAccessToken;
  } catch (error) {
    console.error('[FCM] Error getting access token:', error);
    return null;
  }
}

// Check if FCM is properly configured
const isFCMConfigured = (): boolean => {
  return !!(FIREBASE_SA_CLIENT_EMAIL && FIREBASE_SA_PRIVATE_KEY);
};

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

/**
 * Get the public VAPID key for FCM client subscription
 */
export function getVapidPublicKey(): string {
  return FCM_VAPID_PUBLIC_KEY;
}

// Flag to track if we've already logged the FCM warning
let fcmWarningLogged = false;

/**
 * Send FCM message using the HTTP v1 API
 */
async function sendFCMMessage(
  token: string,
  payload: PushNotificationPayload
): Promise<{ success: boolean; shouldRemoveToken: boolean; error?: string }> {
  // Check if FCM is properly configured
  if (!isFCMConfigured()) {
    // Log only once per session to avoid spam
    if (!fcmWarningLogged) {
      console.warn('[FCM] Push notifications disabled: Service account not configured');
      console.warn('[FCM] To enable push notifications, set these environment variables:');
      console.warn('[FCM]   FIREBASE_SERVICE_ACCOUNT_CLIENT_EMAIL=<service account email>');
      console.warn('[FCM]   FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY=<private key>');
      fcmWarningLogged = true;
    }
    return { success: false, shouldRemoveToken: false, error: 'FCM not configured' };
  }

  try {
    // Get OAuth2 access token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.error('[FCM] Failed to get access token');
      return { success: false, shouldRemoveToken: false, error: 'Failed to get access token' };
    }

    // FCM v1 API message format
    const message = {
      message: {
        token: token,
        notification: {
          title: payload.title,
          body: payload.message,
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.message,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            requireInteraction: payload.type === 'pending_approval',
          },
          fcm_options: {
            link: payload.url || '/',
          },
        },
        data: {
          type: payload.type,
          title: payload.title,
          message: payload.message,
          url: payload.url || '/',
          contentId: payload.contentId || '',
          contentType: payload.contentType || '',
          timestamp: Date.now().toString(),
        },
        // High priority for web push
        android: {
          priority: 'high',
          ttl: '86400s',
        },
      },
    };

    const response = await fetch(FCM_V1_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorCode = errorData?.error?.code;
      const errorMessage = errorData?.error?.message || response.statusText;
      
      console.error('[FCM] API error:', response.status, errorMessage);
      
      // Check for invalid token errors (v1 API error codes)
      const invalidTokenErrors = [
        'UNREGISTERED',
        'INVALID_ARGUMENT',
        'NOT_FOUND',
      ];
      
      if (errorCode && invalidTokenErrors.some(e => errorMessage.includes(e))) {
        console.log(`[FCM] Invalid token detected: ${errorMessage}`);
        return { success: false, shouldRemoveToken: true, error: errorMessage };
      }
      
      // Auth errors - don't remove token, might be temporary
      if (response.status === 401 || response.status === 403) {
        // Clear cached token to force refresh
        cachedAccessToken = null;
        tokenExpiry = 0;
        return { success: false, shouldRemoveToken: false, error: 'Authentication error' };
      }
      
      return { success: false, shouldRemoveToken: false, error: errorMessage };
    }

    const result = await response.json();
    console.log('[FCM] Message sent successfully:', result.name);
    return { success: true, shouldRemoveToken: false };
  } catch (error) {
    console.error('[FCM] Error sending message:', error);
    return { success: false, shouldRemoveToken: false, error: String(error) };
  }
}

/**
 * Save an FCM token for a user (prevents duplicates by token)
 */
export async function savePushSubscription(
  database: any,
  userId: string,
  token: string,
  userAgent?: string
): Promise<string> {
  try {
    // First check if this token already exists for this user to prevent duplicates
    const userTokensRef = ref(database, `fcmTokens/${userId}`);
    const snapshot = await get(userTokensRef);
    const existingData = snapshot.val();
    
    if (existingData) {
      for (const [tokenId, tokenData] of Object.entries(existingData as Record<string, any>)) {
        if (tokenData?.token === token) {
          // Update existing token instead of creating duplicate
          await set(ref(database, `fcmTokens/${userId}/${tokenId}`), {
            token,
            createdAt: tokenData.createdAt || Date.now(),
            updatedAt: Date.now(),
            lastUsed: Date.now(),
            userAgent,
            failureCount: 0, // Reset failure count on re-registration
          });
          console.log('Updated existing FCM token for user:', userId);
          return tokenId;
        }
      }
    }
    
    // Create new token if no duplicate found
    const tokenRef = push(ref(database, `fcmTokens/${userId}`));
    await set(tokenRef, {
      token,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      userAgent,
      failureCount: 0,
    });
    console.log('Created new FCM token for user:', userId);
    return tokenRef.key!;
  } catch (error) {
    console.error('Error saving FCM token:', error);
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
    const userTokensRef = ref(database, `fcmTokens/${userId}`);
    const snapshot = await get(userTokensRef);
    const data = snapshot.val();

    if (data) {
      for (const [tokenId, tokenData] of Object.entries(data as Record<string, any>)) {
        if (tokenData?.token === token) {
          await remove(ref(database, `fcmTokens/${userId}/${tokenId}`));
          console.log('Removed FCM token for user:', userId);
          return;
        }
      }
    }
  } catch (error) {
    console.error('Error removing FCM token:', error);
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
    console.log(`Removed invalid FCM token ${tokenId} for user ${userId}`);
  } catch (error) {
    console.error('Error removing token by ID:', error);
  }
}

/**
 * Update token failure count
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
      return;
    }
    
    await set(ref(database, `fcmTokens/${userId}/${tokenId}/failureCount`), newFailureCount);
  } catch (error) {
    console.error('Error updating token failure count:', error);
  }
}

/**
 * Get all FCM tokens for a user
 */
export async function getUserFCMTokens(
  database: any,
  userId: string
): Promise<StoredFCMToken[]> {
  try {
    const userTokensRef = ref(database, `fcmTokens/${userId}`);
    const snapshot = await get(userTokensRef);
    const data = snapshot.val();

    if (!data) {
      return [];
    }

    const tokens: StoredFCMToken[] = [];
    const now = Date.now();
    
    for (const [tokenId, tokenData] of Object.entries(data as Record<string, any>)) {
      if (tokenData?.token) {
        // Skip expired tokens (older than 30 days without activity)
        const lastActivity = tokenData.lastUsed || tokenData.updatedAt || tokenData.createdAt;
        if (now - lastActivity > TOKEN_EXPIRY_MS) {
          // Clean up expired token
          await removeTokenById(database, userId, tokenId);
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

    return tokens;
  } catch (error) {
    console.error('Error getting user FCM tokens:', error);
    return [];
  }
}

/**
 * Get all FCM tokens from the database
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
    
    for (const [userId, userTokens] of Object.entries(data as Record<string, any>)) {
      if (excludeUserId && userId === excludeUserId) continue;
      
      if (typeof userTokens === 'object' && userTokens !== null) {
        for (const [tokenId, tokenData] of Object.entries(userTokens as Record<string, any>)) {
          if (tokenData?.token) {
            // Skip expired tokens
            const lastActivity = tokenData.lastUsed || tokenData.updatedAt || tokenData.createdAt;
            if (now - lastActivity > TOKEN_EXPIRY_MS) {
              await removeTokenById(database, userId, tokenId);
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

    return tokens;
  } catch (error) {
    console.error('Error getting all FCM tokens:', error);
    return [];
  }
}

/**
 * Send push notification to a specific user via FCM
 */
export async function sendPushToUser(
  database: any,
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  const stats = { sent: 0, failed: 0, removed: 0 };

  try {
    const tokens = await getUserFCMTokens(database, userId);
    
    if (tokens.length === 0) {
      console.log(`No FCM tokens found for user: ${userId}`);
      return stats;
    }

    console.log(`Sending push to ${tokens.length} device(s) for user: ${userId}`);

    // Send to all user devices in parallel
    const results = await Promise.allSettled(
      tokens.map(async (tokenData) => {
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
        await set(ref(database, `fcmTokens/${userId}/${tokenData.id}/lastUsed`), Date.now());
        await set(ref(database, `fcmTokens/${userId}/${tokenData.id}/failureCount`), 0);
        
        return { success: true, removed: false };
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) stats.sent++;
        else if (result.value.removed) stats.removed++;
        else stats.failed++;
      } else {
        stats.failed++;
      }
    });

    console.log(`Push to user ${userId} complete: ${stats.sent} sent, ${stats.failed} failed, ${stats.removed} removed`);
    return stats;
  } catch (error) {
    console.error('Error sending push notification to user:', error);
    return stats;
  }
}

/**
 * Broadcast push notification to all users via FCM
 */
export async function broadcastPushNotification(
  database: any,
  payload: PushNotificationPayload,
  excludeUserId?: string
): Promise<{ sent: number; failed: number; removed: number }> {
  const stats = { sent: 0, failed: 0, removed: 0 };

  try {
    const tokens = await getAllFCMTokens(database, excludeUserId);
    
    if (tokens.length === 0) {
      console.log('No FCM tokens found for broadcast');
      return stats;
    }

    console.log(`Broadcasting to ${tokens.length} device(s)`);

    // Process in batches of 100 to avoid overwhelming the FCM API
    const BATCH_SIZE = 100;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      
      const results = await Promise.allSettled(
        batch.map(async (tokenData) => {
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
          await set(ref(database, `fcmTokens/${tokenData.userId}/${tokenData.id}/lastUsed`), Date.now());
          await set(ref(database, `fcmTokens/${tokenData.userId}/${tokenData.id}/failureCount`), 0);
          
          return { success: true, removed: false };
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) stats.sent++;
          else if (result.value.removed) stats.removed++;
          else stats.failed++;
        } else {
          stats.failed++;
        }
      });
      
      // Small delay between batches
      if (i + BATCH_SIZE < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Push broadcast complete: ${stats.sent} sent, ${stats.failed} failed, ${stats.removed} removed`);
    return stats;
  } catch (error) {
    console.error('Error broadcasting push notifications:', error);
    return stats;
  }
}

/**
 * Cleanup stale tokens (tokens that haven't been used in 30+ days)
 */
export async function cleanupStaleTokens(database: any): Promise<number> {
  let cleaned = 0;
  
  try {
    const tokensRef = ref(database, 'fcmTokens');
    const snapshot = await get(tokensRef);
    const data = snapshot.val();

    if (!data) return 0;

    const now = Date.now();
    
    for (const [userId, userTokens] of Object.entries(data as Record<string, any>)) {
      if (typeof userTokens === 'object' && userTokens !== null) {
        for (const [tokenId, tokenData] of Object.entries(userTokens as Record<string, any>)) {
          if (tokenData) {
            const lastActivity = tokenData.lastUsed || tokenData.updatedAt || tokenData.createdAt;
            if (now - lastActivity > TOKEN_EXPIRY_MS) {
              await removeTokenById(database, userId, tokenId);
              cleaned++;
            }
          }
        }
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} stale FCM tokens`);
    }
    
    return cleaned;
  } catch (error) {
    console.error('Error cleaning up stale tokens:', error);
    return cleaned;
  }
}

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
