import { ref, get, set, push, remove } from 'firebase/database';

// Firebase Cloud Messaging VAPID Key for Web Push
const FCM_VAPID_PUBLIC_KEY = process.env.VITE_FIREBASE_VAPID_KEY || 'BIWt-uVrufpuhAlGMo3JZw-ZkiJ1mIFrMqe2zModpFsclumO45KnbVZdQAzFJkMWF8Dfy-AmtoD2OEf5wS6ZXS8';

// FCM token storage structure
export interface StoredFCMToken {
  id: string;
  userId: string;
  token: string;
  createdAt: number;
  updatedAt?: number;
  userAgent?: string;
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
            userAgent,
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
      userAgent,
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
    Object.entries(data as Record<string, any>).forEach(([tokenId, tokenData]) => {
      if (tokenData?.token) {
        tokens.push({
          id: tokenId,
          userId,
          token: tokenData.token,
          createdAt: tokenData.createdAt || Date.now(),
          updatedAt: tokenData.updatedAt,
          userAgent: tokenData.userAgent,
        });
      }
    });

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
    Object.entries(data as Record<string, any>).forEach(([userId, userTokens]) => {
      if (excludeUserId && userId === excludeUserId) return;
      
      if (typeof userTokens === 'object' && userTokens !== null) {
        Object.entries(userTokens as Record<string, any>).forEach(([tokenId, tokenData]) => {
          if (tokenData?.token) {
            tokens.push({
              id: tokenId,
              userId,
              token: tokenData.token,
              createdAt: tokenData.createdAt || Date.now(),
              updatedAt: tokenData.updatedAt,
              userAgent: tokenData.userAgent,
            });
          }
        });
      }
    });

    return tokens;
  } catch (error) {
    console.error('Error getting all FCM tokens:', error);
    return [];
  }
}

/**
 * Store notification in user's notification queue for FCM delivery
 * FCM delivery is handled client-side via Firebase Cloud Messaging
 */
export async function sendPushToUser(
  database: any,
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; removed: number }> {
  const stats = { sent: 0, failed: 0, removed: 0 };

  try {
    // Store the push notification data in a pending queue for the user
    // The actual FCM delivery happens via Firebase's onMessage handlers
    const pendingRef = push(ref(database, `pendingPushNotifications/${userId}`));
    await set(pendingRef, {
      ...payload,
      createdAt: Date.now(),
      delivered: false,
    });
    
    stats.sent = 1;
    console.log(`Queued push notification for user: ${userId}`);
    return stats;
  } catch (error) {
    console.error('Error queueing push notification for user:', error);
    stats.failed = 1;
    return stats;
  }
}

/**
 * Broadcast push notification to all users by storing in their pending queues
 */
export async function broadcastPushNotification(
  database: any,
  payload: PushNotificationPayload,
  excludeUserId?: string
): Promise<{ sent: number; failed: number; removed: number }> {
  const stats = { sent: 0, failed: 0, removed: 0 };

  try {
    // Get all users with FCM tokens
    const tokens = await getAllFCMTokens(database, excludeUserId);
    
    // Get unique user IDs
    const userIds = Array.from(new Set(tokens.map(t => t.userId)));
    
    console.log(`Broadcasting to ${userIds.length} users`);

    // Queue notification for each user
    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        const pendingRef = push(ref(database, `pendingPushNotifications/${userId}`));
        await set(pendingRef, {
          ...payload,
          createdAt: Date.now(),
          delivered: false,
        });
        return true;
      })
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        stats.sent++;
      } else {
        stats.failed++;
      }
    });

    console.log(`Push broadcast complete: ${stats.sent} queued, ${stats.failed} failed`);
    return stats;
  } catch (error) {
    console.error('Error broadcasting push notifications:', error);
    return stats;
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
};
