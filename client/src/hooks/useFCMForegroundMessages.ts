import { useEffect, useRef } from 'react';
import { onFCMMessage, initializeMessaging } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook to handle FCM messages when the app is in the foreground.
 * Shows a toast notification when a message is received.
 */
export function useFCMForegroundMessages() {
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    const setupForegroundMessages = async () => {
      try {
        // Wait for messaging to be initialized
        await initializeMessaging();

        // Set up foreground message handler
        const unsubscribe = onFCMMessage((payload) => {
          console.log('[FCM] Foreground message received:', payload);

          const notification = payload.notification || {};
          const data = payload.data || {};

          const title = notification.title || data.title || 'New Notification';
          const body = notification.body || data.message || 'You have a new notification';

          // Show toast for foreground messages
          toast({
            title: title,
            description: body,
            duration: 5000,
          });

          // Also show a browser notification if available
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(title, {
                body: body,
                icon: '/icon-192x192.png',
                badge: '/badge-72x72.png',
                tag: data.type || 'notification',
              });
            } catch (error) {
              // Fallback - notification might not be allowed in foreground
              console.log('[FCM] Browser notification skipped:', error);
            }
          }
        });

        if (unsubscribe) {
          unsubscribeRef.current = unsubscribe;
        }
      } catch (error) {
        console.error('[FCM] Error setting up foreground messages:', error);
      }
    };

    // Delay setup to not block initial render
    const timeoutId = setTimeout(setupForegroundMessages, 2000);

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [toast]);
}

export default useFCMForegroundMessages;
