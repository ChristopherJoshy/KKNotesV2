import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import pushNotifications, { 
  getVapidPublicKey, 
  savePushSubscription, 
  removePushSubscription,
  broadcastPushNotification,
  sendPushToUser,
  cleanupStaleTokens,
  type PushNotificationPayload 
} from "./pushNotifications";

// ==================== PRODUCTION SECURITY & RATE LIMITING ====================

// Simple in-memory rate limiter for production
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter middleware factory
 * @param maxRequests Maximum requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @param keyPrefix Prefix for the rate limit key
 */
function rateLimit(maxRequests: number, windowMs: number, keyPrefix: string = 'rl') {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
      return next();
    }
    
    entry.count++;
    
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter,
        message: 'Please slow down and try again later'
      });
    }
    
    next();
  };
}

/**
 * Validate required fields in request body
 */
function validateBody(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = requiredFields.filter(field => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });
    
    if (missing.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        fields: missing 
      });
    }
    next();
  };
}

/**
 * Sanitize string input to prevent injection
 */
function sanitizeString(str: string, maxLength: number = 1000): string {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

/**
 * Validate FCM token format
 */
function isValidFCMToken(token: string): boolean {
  return typeof token === 'string' && 
         token.length >= 100 && 
         token.length <= 500 && 
         /^[A-Za-z0-9:_-]+$/.test(token);
}

/**
 * Validate user ID format (Firebase UID)
 */
function isValidUserId(userId: string): boolean {
  return typeof userId === 'string' && 
         userId.length >= 20 && 
         userId.length <= 128 && 
         /^[A-Za-z0-9]+$/.test(userId);
}

/**
 * Log API requests for monitoring
 */
function logRequest(action: string, userId?: string, details?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[API] ${timestamp} | ${action}${userId ? ` | user:${userId.substring(0, 8)}...` : ''}`, details || '');
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // ==================== FCM PUSH NOTIFICATION ROUTES ====================
  
  // Get VAPID public key for FCM client subscription
  // Rate limited to prevent abuse (100 requests per minute per IP)
  app.get("/api/push/vapid-public-key", 
    rateLimit(100, 60000, 'vapid'),
    (req, res) => {
      // Add cache headers - VAPID key rarely changes
      res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.json({ publicKey: getVapidPublicKey() });
    }
  );

  // Subscribe to push notifications (save FCM token)
  // Rate limited to 10 requests per minute per IP (prevents token flooding)
  app.post("/api/push/subscribe", 
    rateLimit(10, 60000, 'subscribe'),
    validateBody(['userId', 'token']),
    async (req, res) => {
      try {
        const userId = sanitizeString(req.body.userId, 128);
        const token = sanitizeString(req.body.token, 500);
        const userAgent = sanitizeString(req.body.userAgent || '', 500);
        
        // Validate user ID format
        if (!isValidUserId(userId)) {
          logRequest('subscribe:invalid_user', userId);
          return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        // Validate FCM token format
        if (!isValidFCMToken(token)) {
          logRequest('subscribe:invalid_token', userId);
          return res.status(400).json({ error: 'Invalid FCM token format' });
        }

        const database = storage.getDatabase();
        const tokenId = await savePushSubscription(database, userId, token, userAgent);
        
        logRequest('subscribe:success', userId, { tokenId: tokenId.substring(0, 8) });
        res.json({ message: 'FCM token saved', tokenId });
      } catch (error: any) {
        const userId = req.body.userId?.substring?.(0, 8) || 'unknown';
        logRequest('subscribe:error', userId, { error: error.message });
        console.error('[Push] Error saving FCM token:', error);
        res.status(500).json({ error: 'Failed to save FCM token' });
      }
    }
  );

  // Unsubscribe from push notifications (remove FCM token)
  // Rate limited to 10 requests per minute per IP
  app.post("/api/push/unsubscribe", 
    rateLimit(10, 60000, 'unsubscribe'),
    validateBody(['userId', 'token']),
    async (req, res) => {
      try {
        const userId = sanitizeString(req.body.userId, 128);
        const token = sanitizeString(req.body.token, 500);
        
        // Validate user ID format
        if (!isValidUserId(userId)) {
          return res.status(400).json({ error: 'Invalid user ID format' });
        }

        const database = storage.getDatabase();
        await removePushSubscription(database, userId, token);
        
        logRequest('unsubscribe:success', userId);
        res.json({ message: 'FCM token removed' });
      } catch (error: any) {
        logRequest('unsubscribe:error', req.body.userId, { error: error.message });
        console.error('[Push] Error removing FCM token:', error);
        res.status(500).json({ error: 'Failed to remove FCM token' });
      }
    }
  );

  // Broadcast push notification to all users (admin only)
  // Strictly rate limited to 5 requests per minute (broadcasts are expensive)
  app.post("/api/push/broadcast", 
    rateLimit(5, 60000, 'broadcast'),
    validateBody(['title', 'message']),
    async (req, res) => {
      try {
        const type = sanitizeString(req.body.type || 'admin_content_added', 50);
        const title = sanitizeString(req.body.title, 200);
        const message = sanitizeString(req.body.message, 500);
        const url = sanitizeString(req.body.url || '/', 500);
        const contentId = req.body.contentId ? sanitizeString(req.body.contentId, 128) : undefined;
        const contentType = req.body.contentType ? sanitizeString(req.body.contentType, 20) : undefined;
        const excludeUserId = req.body.excludeUserId ? sanitizeString(req.body.excludeUserId, 128) : undefined;
        
        // Validate notification type
        const validTypes = [
          'admin_content_added', 'content_approved', 'pending_approval',
          'submission_approved', 'submission_rejected', 'content_rated',
          'content_reported', 'admin_added', 'admin_removed', 'report_reviewed'
        ];
        if (!validTypes.includes(type)) {
          return res.status(400).json({ error: 'Invalid notification type' });
        }

        const payload: PushNotificationPayload = {
          type,
          title,
          message,
          url,
          contentId,
          contentType,
        };

        const database = storage.getDatabase();
        const stats = await broadcastPushNotification(database, payload, excludeUserId);
        
        logRequest('broadcast:complete', excludeUserId, stats);
        res.json({ message: 'Broadcast complete', ...stats });
      } catch (error: any) {
        logRequest('broadcast:error', undefined, { error: error.message });
        console.error('[Push] Error broadcasting notification:', error);
        res.status(500).json({ error: 'Failed to broadcast notification' });
      }
    }
  );

  // Send push notification to a specific user (for background notifications)
  // Rate limited to 30 requests per minute per IP
  app.post("/api/push/send-to-user", 
    rateLimit(30, 60000, 'send-user'),
    validateBody(['userId', 'payload']),
    async (req, res) => {
      try {
        const userId = sanitizeString(req.body.userId, 128);
        const payload = req.body.payload;
        
        // Validate user ID
        if (!isValidUserId(userId)) {
          return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        // Validate payload structure
        if (typeof payload !== 'object' || payload === null) {
          return res.status(400).json({ error: 'Invalid payload format' });
        }

        const notificationPayload: PushNotificationPayload = {
          type: sanitizeString(payload.type || 'pending_approval', 50),
          title: sanitizeString(payload.title || 'KKNotes Update', 200),
          message: sanitizeString(payload.message || 'You have a new notification', 500),
          url: sanitizeString(payload.url || '/', 500),
          contentId: payload.contentId ? sanitizeString(payload.contentId, 128) : undefined,
          contentType: payload.contentType ? sanitizeString(payload.contentType, 20) : undefined,
        };

        const database = storage.getDatabase();
        const stats = await sendPushToUser(database, userId, notificationPayload);
        
        logRequest('send-to-user:complete', userId, stats);
        res.json({ message: 'Notification sent', ...stats });
      } catch (error: any) {
        logRequest('send-to-user:error', req.body.userId, { error: error.message });
        console.error('[Push] Error sending notification to user:', error);
        res.status(500).json({ error: 'Failed to send notification' });
      }
    }
  );

  // Cleanup stale FCM tokens (can be called periodically or via cron)
  // Strictly rate limited to 1 request per minute (cleanup is expensive)
  app.post("/api/push/cleanup", 
    rateLimit(1, 60000, 'cleanup'),
    async (req, res) => {
      try {
        const startTime = Date.now();
        const database = storage.getDatabase();
        const cleaned = await cleanupStaleTokens(database);
        const duration = Date.now() - startTime;
        
        logRequest('cleanup:complete', undefined, { cleaned, durationMs: duration });
        res.json({ 
          message: 'Cleanup complete', 
          cleaned,
          durationMs: duration
        });
      } catch (error: any) {
        logRequest('cleanup:error', undefined, { error: error.message });
        console.error('[Push] Error cleaning up tokens:', error);
        res.status(500).json({ error: 'Failed to cleanup tokens' });
      }
    }
  );

  // Health check endpoint for push notification service
  app.get("/api/push/health", 
    rateLimit(60, 60000, 'health'),
    (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'push-notifications',
        timestamp: Date.now()
      });
    }
  );

  // ==================== EXISTING API ROUTES ====================
  
  // Get subjects for a semester
  app.get("/api/subjects/:semester", async (req, res) => {
    try {
      const { semester } = req.params;
      const subjects = await storage.getSubjects(semester);
      res.json(subjects);
    } catch (error) {
      console.error('Error getting subjects:', error);
      res.status(500).json({ error: 'Failed to fetch subjects' });
    }
  });

  // Get notes for a subject
  app.get("/api/notes/:semester/:subjectId", async (req, res) => {
    try {
      const { semester, subjectId } = req.params;
      const notes = await storage.getNotesBySubject(semester, subjectId);
      res.json(notes);
    } catch (error) {
      console.error('Error getting notes:', error);
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  });

  // Upload a new note (admin only)
  app.post("/api/notes", upload.single('file'), async (req, res) => {
    try {
      const { semester, subjectId, title, description, uploadedBy } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      if (!semester || !subjectId || !title || !uploadedBy) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const noteData = {
        semester,
        subjectId,
        title,
        description: description || "",
        url: "", // Will be set by storage layer
  uploadedBy,
  category: "notes" as const
      };

      const noteId = await storage.createNote(noteData, file.buffer, file.originalname);
      res.json({ noteId, message: 'Note uploaded successfully' });
    } catch (error) {
      console.error('Error uploading note:', error);
      res.status(500).json({ error: 'Failed to upload note' });
    }
  });

  // Delete a note (admin only)
  app.delete("/api/notes/:noteId", async (req, res) => {
    try {
      const { noteId } = req.params;
      await storage.deleteNote(noteId);
      res.json({ message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Error deleting note:', error);
      res.status(500).json({ error: 'Failed to delete note' });
    }
  });

  // Increment download counter
  app.post("/api/notes/:noteId/download", async (req, res) => {
    try {
      const { noteId } = req.params;
      await storage.incrementDownload(noteId);
      res.json({ message: 'Download recorded' });
    } catch (error) {
      console.error('Error recording download:', error);
      res.status(500).json({ error: 'Failed to record download' });
    }
  });

  // User management
  app.post("/api/users", async (req, res) => {
    try {
      const userData = req.body;
      await storage.createUser(userData);
      res.json({ message: 'User created successfully' });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  app.get("/api/users/:uid", async (req, res) => {
    try {
      const { uid } = req.params;
      const user = await storage.getUser(uid);
      if (user) {
        res.json(user);
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  // Initialize subjects endpoint
  app.post("/api/init", async (req, res) => {
    try {
      await storage.initializeSubjects();
      res.json({ message: 'Subjects initialized successfully' });
    } catch (error) {
      console.error('Error initializing subjects:', error);
      res.status(500).json({ error: 'Failed to initialize subjects' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
