import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";

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
  // API Routes for Firebase operations
  
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
