import type { Express } from "express";
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
  app.get("/api/push/vapid-public-key", (req, res) => {
    res.json({ publicKey: getVapidPublicKey() });
  });

  // Subscribe to push notifications (save FCM token)
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { userId, token, userAgent } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }
      
      if (!token) {
        return res.status(400).json({ error: 'Missing FCM token' });
      }
      
      // Validate token format (FCM tokens are typically long strings)
      if (typeof token !== 'string' || token.length < 100) {
        return res.status(400).json({ error: 'Invalid FCM token format' });
      }

      const database = storage.getDatabase();
      const tokenId = await savePushSubscription(database, userId, token, userAgent);
      
      console.log(`[Push] Token saved for user ${userId}: ${token.substring(0, 20)}...`);
      res.json({ message: 'FCM token saved', tokenId });
    } catch (error) {
      console.error('[Push] Error saving FCM token:', error);
      res.status(500).json({ error: 'Failed to save FCM token' });
    }
  });

  // Unsubscribe from push notifications (remove FCM token)
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { userId, token } = req.body;
      
      if (!userId || !token) {
        return res.status(400).json({ error: 'Missing userId or token' });
      }

      const database = storage.getDatabase();
      await removePushSubscription(database, userId, token);
      
      console.log(`[Push] Token removed for user ${userId}`);
      res.json({ message: 'FCM token removed' });
    } catch (error) {
      console.error('[Push] Error removing FCM token:', error);
      res.status(500).json({ error: 'Failed to remove FCM token' });
    }
  });

  // Broadcast push notification to all users (admin only)
  app.post("/api/push/broadcast", async (req, res) => {
    try {
      const { type, title, message, url, contentId, contentType, excludeUserId } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ error: 'Missing title or message' });
      }

      const payload: PushNotificationPayload = {
        type: type || 'admin_content_added',
        title,
        message,
        url: url || '/',
        contentId,
        contentType,
      };

      const database = storage.getDatabase();
      const stats = await broadcastPushNotification(database, payload, excludeUserId);
      
      console.log(`[Push] Broadcast complete:`, stats);
      res.json({ message: 'Broadcast complete', ...stats });
    } catch (error) {
      console.error('[Push] Error broadcasting notification:', error);
      res.status(500).json({ error: 'Failed to broadcast notification' });
    }
  });

  // Send push notification to a specific user (for background notifications)
  app.post("/api/push/send-to-user", async (req, res) => {
    try {
      const { userId, payload } = req.body;
      
      if (!userId || !payload) {
        return res.status(400).json({ error: 'Missing userId or payload' });
      }

      const notificationPayload: PushNotificationPayload = {
        type: payload.type || 'pending_approval',
        title: payload.title || 'KKNotes Update',
        message: payload.message || 'You have a new notification',
        url: payload.url || '/',
        contentId: payload.contentId,
        contentType: payload.contentType,
      };

      const database = storage.getDatabase();
      const stats = await sendPushToUser(database, userId, notificationPayload);
      
      console.log(`[Push] Sent to user ${userId}:`, stats);
      res.json({ message: 'Notification sent', ...stats });
    } catch (error) {
      console.error('[Push] Error sending notification to user:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  // Cleanup stale FCM tokens (can be called periodically or via cron)
  app.post("/api/push/cleanup", async (req, res) => {
    try {
      const database = storage.getDatabase();
      const cleaned = await cleanupStaleTokens(database);
      
      console.log(`[Push] Cleaned up ${cleaned} stale tokens`);
      res.json({ message: 'Cleanup complete', cleaned });
    } catch (error) {
      console.error('[Push] Error cleaning up tokens:', error);
      res.status(500).json({ error: 'Failed to cleanup tokens' });
    }
  });

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
