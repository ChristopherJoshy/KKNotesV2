import { useEffect, useRef, useCallback } from 'react';
import { onFCMMessage, initializeMessaging, isFCMReady } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface FCMPayload {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: {
    type?: string;
    title?: string;
    message?: string;
    url?: string;
    contentId?: string;
    contentType?: string;
  };
}

/**
 * Hook to handle FCM messages when the app is in the foreground.
 * Shows a toast notification when a message is received.
 * Production-ready with proper cleanup and error handling.
 */
export function useFCMForegroundMessages() {
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  const handleMessage = useCallback((payload: FCMPayload) => {
    if (!mountedRef.current) return;
    
    console.log('[FCM] Foreground message received:', payload);

    const notification = payload.notification || {};
    const data = payload.data || {};

    const title = notification.title || data.title || 'New Notification';
    const body = notification.body || data.message || 'You have a new notification';
    const type = data.type || 'default';

    // Show toast for foreground messages
    toast({
      title: title,
      description: body,
      duration: 5000,
    });

    // Also show a browser notification if available and the document is hidden
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try {
        // Use service worker to show notification for better reliability
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
              body: body,
              icon: '/icon-192x192.png',
              badge: '/badge-72x72.png',
              tag: `foreground-${type}-${Date.now()}`,
              data: {
                url: data.url || '/',
                type: type,
              }
            });
          }).catch(console.error);
        }
      } catch (error) {
        // Fallback - notification might not be allowed
        console.debug('[FCM] Browser notification skipped:', error);
      }
    }
  }, [toast]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Prevent double initialization in strict mode
    if (initializedRef.current) return;
    initializedRef.current = true;

    const setupForegroundMessages = async () => {
      try {
        // Check if FCM is ready
        const ready = await isFCMReady();
        if (!ready) {
          console.debug('[FCM] FCM not ready for foreground messages');
          return;
        }

        // Wait for messaging to be initialized
        const messaging = await initializeMessaging();
        if (!messaging) {
          console.debug('[FCM] Messaging not available');
          return;
        }

        // Set up foreground message handler
        const unsubscribe = onFCMMessage(handleMessage);

        if (unsubscribe) {
          unsubscribeRef.current = unsubscribe;
          console.log('[FCM] Foreground message handler set up');
        }
      } catch (error) {
        console.error('[FCM] Error setting up foreground messages:', error);
      }
    };

    // Delay setup to not block initial render
    const timeoutId = setTimeout(setupForegroundMessages, 2000);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [handleMessage]);
}

export default useFCMForegroundMessages;
