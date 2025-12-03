import webpush from 'web-push';
import { ref, get, set, push, remove } from 'firebase/database';

// VAPID keys for web push - these should be stored securely in environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BFMbqx7sR9_bsMHeK6H0Sw35xzQcOMNIU6GpII3esXGhf20DO-6PC28dSWtU9L3R2xlZSRHZpyPnDCg1Kvj5kgM';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'LHYEqEsOKH5kR5DkVK7_XHak0s--3Qrbdxtg9uAvBCY';

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@kknotes.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export interface PushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredSubscription {
  id: string;
  userId: string;
  subscription: PushSubscription;
  createdAt: number;
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
 * Get the public VAPID key for client subscription
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

/**
 * Send push notification to a single subscription
 */
export async function sendPushToSubscription(
  subscription: PushSubscription,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60 * 24, // 24 hours
        urgency: 'normal',
      }
    );
    return true;
  } catch (error: any) {
    // Handle expired subscriptions
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log('Subscription expired or invalid:', error.statusCode);
      return false;
    }
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * Broadcast push notification to all subscriptions in the database
 */
export async function broadcastPushNotification(
  database: any,
  payload: PushNotificationPayload,
  excludeUserId?: string
): Promise<{ sent: number; failed: number; removed: number }> {
  const stats = { sent: 0, failed: 0, removed: 0 };

  try {
    const subscriptionsRef = ref(database, 'pushSubscriptions');
    const snapshot = await get(subscriptionsRef);
    const data = snapshot.val();

    if (!data) {
      console.log('No push subscriptions found');
      return stats;
    }

    const subscriptions: StoredSubscription[] = [];
    
    // Collect all subscriptions
    Object.entries(data as Record<string, any>).forEach(([userId, userSubs]) => {
      if (excludeUserId && userId === excludeUserId) return;
      
      if (typeof userSubs === 'object' && userSubs !== null) {
        Object.entries(userSubs as Record<string, any>).forEach(([subId, subData]) => {
          if (subData?.subscription) {
            subscriptions.push({
              id: subId,
              userId,
              subscription: subData.subscription,
              createdAt: subData.createdAt || Date.now(),
              userAgent: subData.userAgent,
            });
          }
        });
      }
    });

    console.log(`Broadcasting to ${subscriptions.length} subscriptions`);

    // Send to all subscriptions in parallel
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const success = await sendPushToSubscription(sub.subscription, payload);
        if (!success) {
          // Remove invalid subscription
          try {
            await remove(ref(database, `pushSubscriptions/${sub.userId}/${sub.id}`));
            stats.removed++;
          } catch (e) {
            console.error('Failed to remove invalid subscription:', e);
          }
          return false;
        }
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

    console.log(`Push broadcast complete: ${stats.sent} sent, ${stats.failed} failed, ${stats.removed} removed`);
    return stats;
  } catch (error) {
    console.error('Error broadcasting push notifications:', error);
    return stats;
  }
}

/**
 * Save a push subscription for a user
 */
export async function savePushSubscription(
  database: any,
  userId: string,
  subscription: PushSubscription,
  userAgent?: string
): Promise<string> {
  try {
    const subscriptionRef = push(ref(database, `pushSubscriptions/${userId}`));
    await set(subscriptionRef, {
      subscription,
      createdAt: Date.now(),
      userAgent,
    });
    return subscriptionRef.key!;
  } catch (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(
  database: any,
  userId: string,
  endpoint: string
): Promise<void> {
  try {
    const userSubsRef = ref(database, `pushSubscriptions/${userId}`);
    const snapshot = await get(userSubsRef);
    const data = snapshot.val();

    if (data) {
      for (const [subId, subData] of Object.entries(data as Record<string, any>)) {
        if (subData?.subscription?.endpoint === endpoint) {
          await remove(ref(database, `pushSubscriptions/${userId}/${subId}`));
          console.log('Removed push subscription for user:', userId);
          return;
        }
      }
    }
  } catch (error) {
    console.error('Error removing push subscription:', error);
    throw error;
  }
}

export default {
  getVapidPublicKey,
  sendPushToSubscription,
  broadcastPushNotification,
  savePushSubscription,
  removePushSubscription,
};
