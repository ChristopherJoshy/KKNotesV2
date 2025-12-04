import { useState, useEffect } from "react";
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
import { getFCMToken } from "@/lib/firebase";

/**
 * Subscribe user to FCM push notifications after permission is granted
 */
async function subscribeToPushNotifications(userId: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    // Get service worker registration
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;

    // Get FCM token
    const fcmToken = await getFCMToken();
    
    if (fcmToken) {
      // Save FCM token to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token: fcmToken,
          userAgent: navigator.userAgent
        })
      });
      console.log('FCM token saved for user:', userId);
    }
  } catch (error) {
    console.error('Error subscribing to FCM push notifications:', error);
  }
}

export function NotificationPermissionPrompt() {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const currentPermission = Notification.permission;
    setPermission(currentPermission);

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

  const handleRequestPermission = async () => {
    if (!("Notification" in window) || !user) return;

    setIsRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted" && user) {
        // Subscribe user to push notifications for background delivery
        await subscribeToPushNotifications(user.uid);
        
        // Show a test notification
        new Notification("KKNotes Notifications Enabled! 🎉", {
          body: "You'll now receive updates about your submissions and content.",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "welcome",
        });
      }
      
      setShowPrompt(false);
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    // Store dismissal in session storage so we don't ask again today
    const dismissedKey = `notification_prompt_dismissed_${new Date().toDateString()}`;
    sessionStorage.setItem(dismissedKey, "true");
    setShowPrompt(false);
  };

  // Don't show if not supported, already granted/denied, or not logged in
  if (permission === "unsupported" || permission === "granted" || permission === "denied" || !user) {
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
