import * as React from "react";
import { onValue, off, ref as dbRef } from "firebase/database";
import { 
  signInWithRedirect, 
  getRedirectResult, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User as FirebaseUser
} from "firebase/auth";
import { auth, database, getFCMToken, onFCMMessage } from "@/lib/firebase";
import { firebaseService } from "@/lib/firebaseAdmin";
import { User } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

// Create authentication context with strict typing
const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

/**
 * Register service worker and subscribe to FCM push notifications
 * This enables background notifications even when the app is closed
 */
async function setupPushNotifications(userId: string): Promise<void> {
  try {
    // Check if push notifications are supported
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      console.log('Push notifications not supported in this browser');
      return;
    }

    // Register service worker if not already registered
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered');
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Only proceed if notification permission is granted
    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted yet');
      return;
    }

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

      // Setup foreground message handler
      onFCMMessage((payload) => {
        console.log('Foreground FCM message:', payload);
        // Show notification using service worker when app is in foreground
        if (payload.notification) {
          const { title, body } = payload.notification;
          toast({
            title: title || 'New Notification',
            description: body || 'You have a new notification',
          });
        }
      });
    }
  } catch (error) {
    console.error('Error setting up FCM push notifications:', error);
  }
}

/**
 * Authentication provider component that manages user authentication state
 * Handles Google OAuth flow, user profile management, and role-based access
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // User authentication state management - initialize with explicit null values
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const userSubRef = React.useRef<null | { path: string; unsubscribe: () => void }>(null);

  // Computed authentication and authorization states
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  // Initialize authentication state and listeners
  React.useEffect(() => {
    // Ensure persistence is set as early as possible
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (err) {
        // Fallback for environments where local persistence is unavailable
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch {}
      }
    })();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await handleAuthenticatedUser(firebaseUser);
          // Start or refresh a realtime subscription to this user's record
          subscribeToUser(firebaseUser.uid);
        } else {
          setUser(null);
          // Cleanup any existing user subscription
          if (userSubRef.current) {
            userSubRef.current.unsubscribe();
            userSubRef.current = null;
          }
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    // Handle redirect result on page load and fallback to currentUser
    (async () => {
      await handleRedirectResult();
      // Fallback: if already signed in (persisted) but no state processed yet
      if (auth.currentUser) {
        await handleAuthenticatedUser(auth.currentUser);
        setLoading(false);
      }
    })();

    return () => unsubscribe();
  }, []);

  /**
   * Process authenticated Firebase user and sync with application user data
   * Creates new user records for first-time users with appropriate roles
   */
  const handleAuthenticatedUser = async (firebaseUser: FirebaseUser) => {
    try {
      let userData = await firebaseService.getUser(firebaseUser.uid);

  // Resolve role from DB by email each time, to reflect admin list updates
  const adminRole = await firebaseService.getAdminRoleByEmail(firebaseUser.email);
  const existingRole = ((userData as any)?.role?.toString?.().toLowerCase?.()) || 'student';
  const resolvedRole: User['role'] = (adminRole || existingRole) as User['role'];

      const normalized: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || userData?.email || "",
        name: firebaseUser.displayName || userData?.name || (firebaseUser.email ? firebaseUser.email.split('@')[0] : "User"),
        role: resolvedRole,
        photoURL: firebaseUser.photoURL || userData?.photoURL || undefined,
      };

      await firebaseService.upsertUser(normalized);
      setUser(normalized);
      
      // Setup push notifications for background delivery (even when app is closed)
      setupPushNotifications(firebaseUser.uid);
    } catch (error) {
      console.error("Error handling authenticated user:", error);
      toast({
        title: "Authentication Error",
        description: "Failed to load user profile. Please try again.",
        variant: "destructive"
      });
    }
  };

  /**
   * Handle OAuth redirect results after Google sign-in redirect
   * Shows appropriate success/error messages to user
   */
  const handleRedirectResult = async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user || auth.currentUser) {
        if (result?.user) {
          await handleAuthenticatedUser(result.user);
          subscribeToUser(result.user.uid);
        }
        if (auth.currentUser && !result?.user) {
          subscribeToUser(auth.currentUser.uid);
        }
        toast({
          title: "Welcome!",
          description: "Successfully signed in with Google.",
        });
      }
    } catch (error: any) {
      console.error("Redirect result error:", error);
      toast({
        title: "Sign In Error",
        description: error.message || "Failed to sign in. Please try again.",
        variant: "destructive"
      });
    }
  };

  /**
   * Subscribe to the current user's DB record so role changes (e.g., promotion)
   * are reflected live without requiring sign-out/in.
   */
  const subscribeToUser = (uid: string) => {
    const path = `users/${uid}`;
    const r = dbRef(database, path);
    const listener = (snapshot: any) => {
      const dbUser = snapshot.val() as User | null;
      if (!dbUser) return;
      setUser((prev) => {
        // Preserve any transient fields from prev but prefer DB values
        const merged: User = {
          uid: dbUser.uid || prev?.uid || uid,
          email: dbUser.email || prev?.email || "",
          name: dbUser.name || prev?.name || "User",
          role: dbUser.role || prev?.role || "student",
          photoURL: dbUser.photoURL || prev?.photoURL,
        };
        return merged;
      });
    };

    // Clean up prior subscription if different path
    if (userSubRef.current) {
      userSubRef.current.unsubscribe();
    }
    onValue(r, listener);
    userSubRef.current = {
      path,
      unsubscribe: () => off(r, 'value', listener)
    };
  };

  /**
   * Initiate Google OAuth sign-in flow using redirect method
   * Requests profile and email scopes for user data
   */
  const login = async () => {
    try {
  const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      // Ensure session persists; fallback to session if local fails
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        await setPersistence(auth, browserSessionPersistence);
      }

      // Prefer popup for smoother UX; fallback to redirect if not supported
      try {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          await handleAuthenticatedUser(result.user);
        }
      } catch (popupError: any) {
        const code = popupError?.code || "";
        const shouldFallback = (
          code === 'auth/operation-not-supported-in-this-environment' ||
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user'
        );
        if (shouldFallback) {
          await signInWithRedirect(auth, provider);
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Sign In Error",
        description: error.message || "Failed to initiate sign in.",
        variant: "destructive"
      });
    }
  };

  /**
   * Sign out current user and clear authentication state
   * Provides user feedback on successful logout
   */
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isAdmin,
      loading,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to access authentication context
 * Ensures hook is used within AuthProvider component tree
 * @throws Error if used outside of AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
