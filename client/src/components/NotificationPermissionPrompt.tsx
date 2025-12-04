import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getFCMToken, initializeMessaging, getNotificationPermission } from "@/lib/firebase";

// Service worker registration path - use firebase-messaging-sw.js for FCM
const SW_PATH = '/firebase-messaging-sw.js';

// Local storage key for tracking subscription
const LS_SUBSCRIPTION_KEY = 'fcm_subscription_status';

/**
 * Check if user is already subscribed
 */
function isAlreadySubscribed(): boolean {
  try {
    return localStorage.getItem(LS_SUBSCRIPTION_KEY) === 'subscribed';
  } catch {
    return false;
  }
}

/**
 * Mark user as subscribed
 */
function markAsSubscribed(): void {
  try {
    localStorage.setItem(LS_SUBSCRIPTION_KEY, 'subscribed');
  } catch {
    // Ignore
  }
}

/**
 * Register service worker and subscribe to FCM push notifications
 * Production-ready with proper error handling and retry logic
 */
async function subscribeToPushNotifications(userId: string): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('[Push] Service Worker not supported');
      return false;
    }

    if (!('PushManager' in window)) {
      console.warn('[Push] Push notifications not supported');
      return false;
    }

    // Register the FCM service worker if not already registered
    let registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    
    if (!registration) {
      console.log('[Push] Registering service worker...');
      registration = await navigator.serviceWorker.register(SW_PATH, {
        scope: '/',
      });
      
      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('[Push] Service worker registered');
    }

    // Initialize Firebase Messaging
    await initializeMessaging();

    // Get FCM token (with retry built-in)
    const fcmToken = await getFCMToken(true); // Force refresh
    
    if (!fcmToken) {
      console.warn('[Push] Failed to get FCM token');
      return false;
    }

    // Save FCM token to server with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token: fcmToken,
          userAgent: navigator.userAgent
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        console.error('[Push] Failed to save token:', error);
        return false;
      }

      console.log('[Push] Successfully subscribed to push notifications');
      markAsSubscribed();
      return true;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('[Push] Subscription request timed out');
    } else {
      console.error('[Push] Error subscribing to notifications:', error);
    }
    return false;
  }
}

export function NotificationPermissionPrompt() {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isRequesting, setIsRequesting] = useState(false);

  // Check permissions and subscription status
  useEffect(() => {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const currentPermission = getNotificationPermission();
    setPermission(currentPermission);

    // Don't show if already subscribed
    if (isAlreadySubscribed()) {
      return;
    }

    // Show prompt only if:
    // 1. User is logged in
    // 2. Permission is "default" (not yet decided)
    // 3. User hasn't dismissed it this session
    const dismissedKey = `notification_prompt_dismissed_${new Date().toDateString()}`;
    const wasDismissedToday = sessionStorage.getItem(dismissedKey);

    if (user && currentPermission === "default" && !wasDismissedToday) {
      // Small delay to not interrupt the user immediately
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [user]);

  // Memoized permission request handler
  const handleRequestPermission = useCallback(async () => {
    if (!("Notification" in window) || !user) return;

    setIsRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted" && user) {
        // Subscribe user to push notifications for background delivery
        const success = await subscribeToPushNotifications(user.uid);
        
        if (success) {
          // Show a test notification
          new Notification("KKNotes Notifications Enabled! 🎉", {
            body: "You'll now receive updates about your submissions and content.",
            icon: "/icon-192x192.svg",
            tag: "welcome",
          });
        } else {
          console.warn('[Push] Subscription partially successful - notifications may not work in background');
        }
      }
      
      setShowPrompt(false);
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    } finally {
      setIsRequesting(false);
    }
  }, [user]);

  // Memoized dismiss handler
  const handleDismiss = useCallback(() => {
    // Store dismissal in session storage so we don't ask again today
    const dismissedKey = `notification_prompt_dismissed_${new Date().toDateString()}`;
    sessionStorage.setItem(dismissedKey, "true");
    setShowPrompt(false);
  }, []);

  // Don't show if not supported, already granted/denied, already subscribed, or not logged in
  if (permission === "unsupported" || permission === "granted" || permission === "denied" || !user || isAlreadySubscribed()) {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-gradient-to-b from-card to-background overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
        
        <DialogHeader className="relative text-center pb-2">
          {/* Animated Bell Icon */}
          <div className="mx-auto mb-4 relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                <BellRing className="h-8 w-8 text-primary-foreground animate-pulse" />
              </div>
            </div>
            {/* Decorative rings */}
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: "2s" }} />
          </div>
          
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Stay Updated with KKNotes
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2">
            Get instant notifications when:
          </DialogDescription>
        </DialogHeader>

        {/* Features List */}
        <div className="relative space-y-3 py-4">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-green-500/10">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-medium">Your submissions are approved</span>
          </div>
          
          <div className="flex items-center gap-3 p-2 rounded-lg bg-yellow-500/10">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-sm">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Your content gets rated</span>
          </div>
          
          <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-500/10">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium">New resources are available</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative flex flex-col gap-2 pt-2">
          <Button 
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 font-semibold"
          >
            {isRequesting ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Enabling...
              </>
            ) : (
              <>
                <BellRing className="h-4 w-4 mr-2" />
                Enable Notifications
              </>
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={handleDismiss}
            className="w-full text-muted-foreground hover:text-foreground text-sm"
          >
            Maybe Later
          </Button>
        </div>
        
        {/* Privacy Note */}
        <p className="relative text-[10px] text-center text-muted-foreground/70 pt-2">
          We'll only send relevant updates. You can disable this anytime in settings.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationPermissionPrompt;
