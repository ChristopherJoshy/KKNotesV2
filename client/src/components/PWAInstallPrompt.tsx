import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed the prompt recently
    const dismissedAt = localStorage.getItem('pwa_install_dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
      // Don't show again for 24 hours after dismissal
      if (hoursSinceDismissed < 24) {
        return;
      }
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show install banner after a delay
      setTimeout(() => {
        setShowInstallBanner(true);
      }, 5000);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
      setShowInstallDialog(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
      }
    } catch (error) {
      console.error('Error installing PWA:', error);
    }

    setDeferredPrompt(null);
    setShowInstallBanner(false);
    setShowInstallDialog(false);
  };

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_install_dismissed', Date.now().toString());
  };

  const handleOpenDialog = () => {
    setShowInstallBanner(false);
    setShowInstallDialog(true);
  };

  // Don't render if already installed or no prompt available
  if (isInstalled || !deferredPrompt) return null;

  return (
    <>
      {/* Fixed Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl shadow-2xl p-4 flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm">Install KKNotes</h4>
              <p className="text-xs opacity-90 mt-0.5">
                Add to home screen for quick access
              </p>
              <div className="flex gap-2 mt-2">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  className="h-7 text-xs"
                  onClick={handleOpenDialog}
                >
                  Learn More
                </Button>
                <Button 
                  size="sm" 
                  className="h-7 text-xs bg-white/20 hover:bg-white/30 border-0"
                  onClick={handleInstall}
                >
                  Install
                </Button>
              </div>
            </div>
            <button 
              onClick={handleDismissBanner}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Install Dialog */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl">
          <DialogHeader className="text-center pb-2">
            <div className="mx-auto mb-4">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Smartphone className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-xl font-bold">
              Install KKNotes App
            </DialogTitle>
            <DialogDescription className="text-sm">
              Get the full app experience on your device
            </DialogDescription>
          </DialogHeader>

          {/* Benefits List */}
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Quick access from home screen</span>
            </div>
            
            <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="text-sm font-medium">Push notifications for updates</span>
            </div>
            
            <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-sm">
                <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <span className="text-sm font-medium">Works offline with cached data</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button 
              onClick={handleInstall}
              className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 font-semibold gap-2"
            >
              <Download className="h-4 w-4" />
              Install Now
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowInstallDialog(false);
                localStorage.setItem('pwa_install_dismissed', Date.now().toString());
              }}
              className="w-full text-muted-foreground hover:text-foreground text-sm"
            >
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PWAInstallPrompt;
