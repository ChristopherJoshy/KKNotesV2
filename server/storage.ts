import { Subject, Note, User, InsertNote } from "@shared/schema";
import { SEMESTERS } from "@shared/schema";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, push, remove } from "firebase/database";

// Firebase configuration - same as client
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCqyKYGmqPVDT6RIEhZ_7Pow8BLi_3mpKs",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "kk-notes.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "kk-notes",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "kk-notes.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "962838091889",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:962838091889:web:c0e18bef12e340cb72f21f",
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://kk-notes-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase for server
const app = initializeApp(firebaseConfig, 'server-app');
const database = getDatabase(app);

export interface IStorage {
  getSubjects(semester: string): Promise<Record<string, Subject>>;
  getNotesBySubject(semester: string, subjectId: string): Promise<Note[]>;
  createNote(note: InsertNote, fileBuffer: Buffer, fileName: string): Promise<string>;
  deleteNote(noteId: string): Promise<void>;
  incrementDownload(noteId: string): Promise<void>;
  getUser(uid: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  initializeSubjects(): Promise<void>;
  getDatabase(): typeof database;
}

export class MemStorage implements IStorage {
  private subjects: Record<string, Record<string, Subject>> = {};
  private notes: Map<string, Note> = new Map();
  private users: Map<string, User> = new Map();
  private noteCounter = 1;

  constructor() {
    // Initialize with default subjects
    this.subjects = { ...SEMESTERS };
  }

  async getSubjects(semester: string): Promise<Record<string, Subject>> {
    return this.subjects[semester] || {};
  }

  async getNotesBySubject(semester: string, subjectId: string): Promise<Note[]> {
    const subject = this.subjects[semester]?.[subjectId];
    if (!subject || !subject.notes) {
      return [];
    }

    const notes: Note[] = [];
    for (const noteId of subject.notes) {
      const note = this.notes.get(noteId);
      if (note) {
        notes.push(note);
      }
    }

    return notes.sort((a, b) => b.timestamp - a.timestamp);
  }

  async createNote(noteData: InsertNote, fileBuffer: Buffer, fileName: string): Promise<string> {
    const noteId = `note_${this.noteCounter++}_${Date.now()}`;
    
    // In a real implementation, this would upload to Firebase Storage
    // For demo purposes, we'll create a mock URL
    const mockUrl = `https://example.com/notes/${fileName}`;
    
    const note: Note = {
      ...noteData,
      id: noteId,
      url: mockUrl,
      timestamp: Date.now(),
      downloads: 0
    };

    this.notes.set(noteId, note);

    // Add note reference to subject
    if (!this.subjects[noteData.semester]) {
      this.subjects[noteData.semester] = {};
    }
    if (!this.subjects[noteData.semester][noteData.subjectId]) {
      // This should not happen if subjects are properly initialized
      return noteId;
    }

    const subject = this.subjects[noteData.semester][noteData.subjectId];
    if (!subject.notes) {
      subject.notes = [];
    }
    subject.notes.push(noteId);

    return noteId;
  }

  async deleteNote(noteId: string): Promise<void> {
    const note = this.notes.get(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // Remove from notes collection
    this.notes.delete(noteId);

    // Remove from subject notes array
    const subject = this.subjects[note.semester]?.[note.subjectId];
    if (subject && subject.notes) {
      subject.notes = subject.notes.filter(id => id !== noteId);
    }
  }

  async incrementDownload(noteId: string): Promise<void> {
    const note = this.notes.get(noteId);
    if (note) {
      note.downloads = (note.downloads || 0) + 1;
      this.notes.set(noteId, note);
    }
  }

  async getUser(uid: string): Promise<User | null> {
    return this.users.get(uid) || null;
  }

  async createUser(user: User): Promise<void> {
    this.users.set(user.uid, user);
  }

  async initializeSubjects(): Promise<void> {
    // Subjects are already initialized in constructor
    // This method is for compatibility with Firebase service
    //Entho Kanjavu Sathanam
  }

  getDatabase(): typeof database {
    return database;
  }
}

export const storage = new MemStorage();
