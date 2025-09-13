import { Subject, Note, User, InsertNote } from "@shared/schema";
import { SEMESTERS } from "@shared/schema";

export interface IStorage {
  getSubjects(semester: string): Promise<Record<string, Subject>>;
  getNotesBySubject(semester: string, subjectId: string): Promise<Note[]>;
  createNote(note: InsertNote, fileBuffer: Buffer, fileName: string): Promise<string>;
  deleteNote(noteId: string): Promise<void>;
  incrementDownload(noteId: string): Promise<void>;
  getUser(uid: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  initializeSubjects(): Promise<void>;
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
}

export const storage = new MemStorage();
