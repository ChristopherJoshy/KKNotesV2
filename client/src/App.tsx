import * as React from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useFCMForegroundMessages } from "@/hooks/useFCMForegroundMessages";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

// Lazy load the notification components to avoid blocking initial render
const NotificationPermissionPrompt = React.lazy(() => import("@/components/NotificationPermissionPrompt"));
const PWAInstallPrompt = React.lazy(() => import("@/components/PWAInstallPrompt"));

/**
 * Application router component using wouter for lightweight routing
 * Handles main application routes and fallback to 404 page
 */
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Component that handles FCM foreground message notifications
 */
function FCMHandler() {
  useFCMForegroundMessages();
  return null;
}

/**
 * Main application component with provider hierarchy
 * Establishes context providers for state management, authentication, and UI
 */
function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <FCMHandler />
            <React.Suspense fallback={null}>
              <NotificationPermissionPrompt />
              <PWAInstallPrompt />
            </React.Suspense>
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
