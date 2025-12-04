import { ref, set, push, remove, onValue, off, get } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { database, storage } from "./firebase";
import { 
  Note, Video, Subject, User, InsertNote, InsertVideo, ContentItem, 
  PendingSubmission, InsertPendingSubmission,
  AppNotification, InsertAppNotification,
  Rating, InsertRating,
  Report, InsertReport,
  Scheme, InsertScheme, DEFAULT_SCHEMES
} from "@shared/schema";

// 30 days in milliseconds
const PENDING_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

// Current scheme (defaults to 2019)
let currentScheme = "2019";

// Subject type for admin management
interface SubjectData {
  id: string;
  name: string;
  code?: string;
  credit?: number;
}

export class FirebaseService {
  // Scheme Management
  getCurrentScheme(): string {
    return currentScheme;
  }

  setCurrentScheme(schemeId: string): void {
    currentScheme = schemeId;
  }

  async getSchemes(): Promise<Scheme[]> {
    try {
      const snap = await get(ref(database, 'schemes'));
      const val = snap.val();
      if (!val) {
        // Initialize with default 2019 scheme
        await this.initializeDefaultScheme();
        return DEFAULT_SCHEMES.map(s => ({ ...s, createdAt: Date.now() }));
      }
      
      return Object.entries(val as Record<string, any>).map(([id, data]) => ({
        id,
        name: data.name || `${id} Scheme`,
        year: data.year || parseInt(id) || 2019,
        description: data.description || '',
        isDefault: data.isDefault || false,
        createdAt: data.createdAt || Date.now(),
        createdBy: data.createdBy,
      })).sort((a, b) => b.year - a.year);
    } catch (error) {
      console.error('Error getting schemes:', error);
      return DEFAULT_SCHEMES.map(s => ({ ...s, createdAt: Date.now() }));
    }
  }

  async initializeDefaultScheme(): Promise<void> {
    try {
      const schemeRef = ref(database, 'schemes/2019');
      await set(schemeRef, {
        name: "2019 Scheme",
        year: 2019,
        description: "KTU 2019 Curriculum",
        isDefault: true,
        createdAt: Date.now(),
      });
    } catch (error) {
      console.error('Error initializing default scheme:', error);
    }
  }

  async createScheme(scheme: InsertScheme): Promise<string> {
    try {
      const schemeId = scheme.year.toString();
      const schemeRef = ref(database, `schemes/${schemeId}`);
      
      // Check if scheme already exists
      const existing = await get(schemeRef);
      if (existing.val()) {
        throw new Error(`Scheme ${schemeId} already exists`);
      }
      
      const schemeData: Scheme = {
        ...scheme,
        id: schemeId,
        createdAt: Date.now(),
      };
      
      await set(schemeRef, schemeData);
      return schemeId;
    } catch (error) {
      console.error('Error creating scheme:', error);
      throw error;
    }
  }

  async deleteScheme(schemeId: string): Promise<void> {
    if (schemeId === "2019") {
      throw new Error("Cannot delete the default 2019 scheme");
    }
    
    try {
      // Delete scheme
      await remove(ref(database, `schemes/${schemeId}`));
      // Also delete all subjects, notes, and videos for this scheme
      await remove(ref(database, `subjects_${schemeId}`));
      await remove(ref(database, `notes_${schemeId}`));
      await remove(ref(database, `videos_${schemeId}`));
    } catch (error) {
      console.error('Error deleting scheme:', error);
      throw error;
    }
  }

  // Get the database path based on scheme
  private getSchemeBasePath(basePath: string, scheme?: string): string {
    const schemeToUse = scheme || currentScheme;
    if (schemeToUse === "2019") {
      return basePath; // Default paths for 2019 scheme
    }
    return `${basePath}_${schemeToUse}`;
  }

  // ==================== SUBJECT MANAGEMENT (Admin Only) ====================
  
  async createSubject(semester: string, subject: SubjectData, scheme?: string): Promise<string> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('subjects', schemeToUse);
      const subjectRef = ref(database, `${basePath}/${semester}/${subject.id}`);
      
      await set(subjectRef, {
        name: subject.name,
        code: subject.code || '',
        credit: subject.credit || 0,
        grade: '',
        notes: [],
        videos: [],
      });
      
      return subject.id;
    } catch (error) {
      console.error('Error creating subject:', error);
      throw error;
    }
  }

  async updateSubjectDetails(semester: string, subjectId: string, updates: Partial<SubjectData>, scheme?: string): Promise<void> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('subjects', schemeToUse);
      const subjectRef = ref(database, `${basePath}/${semester}/${subjectId}`);
      const snapshot = await get(subjectRef);
      const currentData = snapshot.val() || {};
      
      await set(subjectRef, { 
        ...currentData, 
        name: updates.name ?? currentData.name,
        code: updates.code ?? currentData.code,
        credit: updates.credit ?? currentData.credit,
      });
    } catch (error) {
      console.error('Error updating subject:', error);
      throw error;
    }
  }

  async deleteSubject(semester: string, subjectId: string, scheme?: string): Promise<void> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('subjects', schemeToUse);
      
      // Delete the subject
      await remove(ref(database, `${basePath}/${semester}/${subjectId}`));
      
      // Also delete all notes and videos for this subject
      const notesPath = this.getSchemeBasePath('notes', schemeToUse);
      const videosPath = this.getSchemeBasePath('videos', schemeToUse);
      await remove(ref(database, `${notesPath}/${semester}/${subjectId}`));
      await remove(ref(database, `${videosPath}/${semester}/${subjectId}`));
    } catch (error) {
      console.error('Error deleting subject:', error);
      throw error;
    }
  }

  async getSubjectsForScheme(semester: string, scheme: string): Promise<Record<string, Subject>> {
    try {
      const basePath = this.getSchemeBasePath('subjects', scheme);
      const subjectsRef = ref(database, `${basePath}/${semester}`);
      const snapshot = await get(subjectsRef);
      const data = snapshot.val();

      if (!data) return {};

      // Handle array or object shapes
      if (Array.isArray(data)) {
        const map: Record<string, Subject> = {};
        data.forEach((entry: any) => {
          if (!entry || !entry.key) return;
          const id = entry.key;
          map[id] = {
            name: entry.name || id,
            credit: entry.credit || 0,
            grade: "",
            notes: [],
            videos: [],
          } as Subject;
        });
        return map;
      }

      const result: Record<string, Subject> = {};
      Object.entries(data as Record<string, any>).forEach(([id, value]) => {
        if (!value) return;
        if (typeof value === "object" && "name" in value) {
          result[id] = {
            name: value.name,
            credit: value.credit ?? 0,
            grade: value.grade ?? "",
            notes: Array.isArray(value.notes) ? value.notes : [],
            videos: Array.isArray(value.videos) ? value.videos : [],
          };
        } else {
          result[id] = {
            name: value.name || value.title || id,
            credit: value.credit ?? 0,
            grade: value.grade ?? "",
            notes: [],
            videos: [],
          } as Subject;
        }
      });
      return result;
    } catch (error) {
      console.error('Error getting subjects for scheme:', error);
      return {};
    }
  }

  async copySubjectsFromScheme(fromScheme: string, toScheme: string): Promise<void> {
    try {
      const semesters = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
      
      for (const semester of semesters) {
        const subjects = await this.getSubjectsForScheme(semester, fromScheme);
        const toBasePath = this.getSchemeBasePath('subjects', toScheme);
        
        for (const [id, subject] of Object.entries(subjects)) {
          await set(ref(database, `${toBasePath}/${semester}/${id}`), subject);
        }
      }
    } catch (error) {
      console.error('Error copying subjects between schemes:', error);
      throw error;
    }
  }

  // Admin helpers
  async getAdmins(): Promise<Array<{ key: string; email: string; role: string; isPermanent?: boolean; addedAt?: number; addedBy?: string; nickname?: string }>> {
    try {
      const snap = await get(ref(database, 'admins'));
      const val = snap.val();
      const list: Array<{ key: string; email: string; role: string; isPermanent?: boolean; addedAt?: number; addedBy?: string; nickname?: string }> = [];
      if (!val) return list;
      if (Array.isArray(val)) {
        val.forEach((entry, idx) => {
          if (!entry) return;
          if (typeof entry === 'string') {
            list.push({ key: String(idx), email: entry, role: 'admin' });
          } else {
            const e: any = entry;
            list.push({
              key: String(idx),
              email: e.email || e.userEmail || '',
              role: e.role || 'admin',
              isPermanent: !!e.isPermanent,
              addedAt: e.addedAt,
              addedBy: e.addedBy,
              nickname: e.nickname,
            });
          }
        });
      } else if (typeof val === 'object') {
        Object.entries(val as Record<string, any>).forEach(([k, v]) => {
          if (!v) return;
          if (typeof v === 'string') {
            const isEmailKey = k.includes('@');
            if (isEmailKey) {
              list.push({ key: k, email: k, role: typeof v === 'string' ? v : 'admin' });
            } else {
              list.push({ key: k, email: v, role: 'admin' });
            }
          } else {
            const e: any = v;
            const emailFromKey = k.includes('@') ? k : undefined;
            list.push({
              key: k,
              email: e.email || e.userEmail || emailFromKey || '',
              role: e.role || 'admin',
              isPermanent: !!e.isPermanent,
              addedAt: e.addedAt || e.dateAdded,
              addedBy: e.addedBy,
              nickname: e.nickname,
            });
          }
        });
      }
      // Deduplicate by email (case-insensitive)
      const seen = new Set<string>();
      return list.filter(a => {
        const key = a.email.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch (e) {
      console.error('Error getting admins:', e);
      return [];
    }
  }

  private async isProtectedAdmin(email: string): Promise<boolean> {
    try {
      const cfg = await get(ref(database, 'config/permanentAdmin'));
      const permanentEmail = cfg.val();
      if (typeof permanentEmail === 'string' && permanentEmail.toLowerCase() === email.toLowerCase()) return true;
      // Also treat entries marked isPermanent or role superadmin as protected
      const admins = await this.getAdmins();
      const found = admins.find(a => a.email.toLowerCase() === email.toLowerCase());
      return !!(found && (found.isPermanent || (found.role && String(found.role).toLowerCase().includes('super'))));
    } catch {
      return false;
    }
  }

  async addAdmin(params: { email: string; nickname?: string; role?: 'admin' | 'superadmin'; addedBy?: string; addedByName?: string }): Promise<void> {
    const email = params.email.trim();
    if (!email) throw new Error('Email is required');
    // prevent duplicates
    const existing = await this.getAdmins();
    if (existing.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('This email is already an admin');
    }
    const entry: any = {
      email,
      role: params.role || 'admin',
      addedAt: Date.now(),
    };
    if (params.nickname) entry.nickname = params.nickname;
    if (params.addedBy) entry.addedBy = params.addedBy;
    const adminsRef = push(ref(database, 'admins'));
    await set(adminsRef, entry);
    
    // Notify all other admins about the new admin
    await this.notifyAdminsOfAdminChange({
      type: 'added',
      targetEmail: email,
      targetNickname: params.nickname,
      targetRole: params.role || 'admin',
      byUserEmail: params.addedBy,
      byUserName: params.addedByName,
    });
  }

  async removeAdminByKey(adminKey: string, removedBy?: string, removedByName?: string): Promise<void> {
    // Load entry to check protection
    const entrySnap = await get(ref(database, `admins/${adminKey}`));
    const entryVal = entrySnap.val();
    let email: string | null = null;
    let nickname: string | undefined;
    if (!entryVal) throw new Error('Admin not found');
    if (typeof entryVal === 'string') {
      email = entryVal;
    } else if (typeof entryVal === 'object') {
      email = entryVal.email || entryVal.userEmail || (adminKey.includes('@') ? adminKey : null);
      nickname = entryVal.nickname;
    }
    if (!email) throw new Error('Cannot resolve admin email');
    if (await this.isProtectedAdmin(email)) {
      throw new Error('Cannot remove the head admin');
    }
    await remove(ref(database, `admins/${adminKey}`));
    
    // Notify all admins about the removal
    await this.notifyAdminsOfAdminChange({
      type: 'removed',
      targetEmail: email,
      targetNickname: nickname,
      byUserEmail: removedBy,
      byUserName: removedByName,
    });
  }
  
  // Notify all admins when an admin is added or removed
  private async notifyAdminsOfAdminChange(params: {
    type: 'added' | 'removed';
    targetEmail: string;
    targetNickname?: string;
    targetRole?: string;
    byUserEmail?: string;
    byUserName?: string;
  }): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      const targetDisplay = params.targetNickname || params.targetEmail;
      const byDisplay = params.byUserName || params.byUserEmail || 'Unknown';
      
      const title = params.type === 'added' ? 'New Admin Added' : 'Admin Removed';
      const message = params.type === 'added'
        ? `${targetDisplay} (${params.targetEmail}) was added as ${params.targetRole || 'admin'} by ${byDisplay}.`
        : `${targetDisplay} (${params.targetEmail}) was removed from admin by ${byDisplay}.`;
      
      for (const admin of admins) {
        // Don't notify the person who was removed
        if (params.type === 'removed' && admin.email.toLowerCase() === params.targetEmail.toLowerCase()) {
          continue;
        }
        
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: params.type === 'added' ? 'admin_added' : 'admin_removed',
            title,
            message,
            fromUser: params.byUserEmail,
            fromUserName: params.byUserName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying admins of admin change:', error);
    }
  }
  
  // Notes operations
  async createNote(note: InsertNote, file?: File, addedByAdmin?: { uid: string; name?: string; email?: string }): Promise<string> {
    try {
      const scheme = (note as any).scheme || currentScheme;
      // If a file is provided, upload to Storage; otherwise, use provided URL
      let finalUrl = note.url;
      if (file) {
        const fileRef = storageRef(storage, `notes/${scheme}/${note.semester}/${note.subjectId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        finalUrl = await getDownloadURL(snapshot.ref);
      }

      // Create note record in Realtime Database under nested path with finalUrl
      const basePath = this.getSchemeBasePath('notes', scheme);
      const noteRef = push(ref(database, `${basePath}/${note.semester}/${note.subjectId}`));
      const noteData: Note = {
        ...note,
        id: noteRef.key!,
        scheme,
        url: finalUrl || "",
        timestamp: Date.now(),
        downloads: 0,
        category: "notes",
      };

      await set(noteRef, noteData);
      
      // If added by admin directly (not via submission approval), notify other admins
      if (addedByAdmin) {
        await this.notifyAdminsOfDirectContent({
          title: note.title,
          contentType: 'notes',
          addedBy: addedByAdmin.uid,
          addedByName: addedByAdmin.name || addedByAdmin.email,
        });
      }
      
      return noteRef.key!;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  async deleteNote(noteId: string, semester: string, subjectId: string, scheme?: string): Promise<void> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('notes', schemeToUse);
      // Get note data first from nested path
      const noteRef = ref(database, `${basePath}/${semester}/${subjectId}/${noteId}`);
      const noteSnapshot = await get(noteRef);
      const noteData = noteSnapshot.val() as Note;

      if (!noteData) {
        throw new Error('Note not found');
      }

      // Delete file from storage (if URL is a gs:// path, we'd need to derive; download URL works with deleteObject too if same bucket rules)
      try {
        const fileRef = storageRef(storage, noteData.url);
        await deleteObject(fileRef);
      } catch {}

      // Remove from notes collection at nested path
      await remove(noteRef);
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  async getNotesBySubject(semester: string, subjectId: string, scheme?: string): Promise<Note[]> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('notes', schemeToUse);
      const notesRef = ref(database, `${basePath}/${semester}/${subjectId}`);
      const snapshot = await get(notesRef);
      const byKey = snapshot.val() || {};
      const notes: Note[] = Object.entries(byKey).map(([id, val]: [string, any]) => ({
        id,
        scheme: schemeToUse,
        semester,
        subjectId,
        title: (val && val.title) || id,
    url: val.link || val.url,
        uploadedBy: val.addedBy || "",
        timestamp: val.addedAt || 0,
        downloads: typeof val.downloads === 'number' ? val.downloads : 0,
        description: val.description || "",
        category: "notes",
      }));
      return notes.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting notes:', error);
      return [];
    }
  }

  async getVideosBySubject(semester: string, subjectId: string, scheme?: string): Promise<Video[]> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('videos', schemeToUse);
      const videosRef = ref(database, `${basePath}/${semester}/${subjectId}`);
      const snapshot = await get(videosRef);
      const byKey = snapshot.val() || {};
      const videos: Video[] = Object.entries(byKey).map(([id, val]: [string, any]) => ({
        id,
        scheme: schemeToUse,
        semester,
        subjectId,
        title: (val && val.title) || id,
    url: val.link || val.url,
        uploadedBy: val.addedBy || "",
        timestamp: val.addedAt || 0,
        views: typeof val.views === 'number' ? val.views : 0,
        description: val.description || "",
        category: "videos",
      }));
      return videos.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error getting videos:', error);
      return [];
    }
  }

  async createVideo(video: InsertVideo, addedByAdmin?: { uid: string; name?: string; email?: string }): Promise<string> {
    try {
      const scheme = (video as any).scheme || currentScheme;
      const basePath = this.getSchemeBasePath('videos', scheme);
      // Create video record in Realtime Database under nested path
      const videoRef = push(ref(database, `${basePath}/${video.semester}/${video.subjectId}`));
      const videoData: Video = {
        ...video,
        id: videoRef.key!,
        scheme,
        timestamp: Date.now(),
        views: 0,
        category: "videos",
      };

      await set(videoRef, videoData);
      
      // If added by admin directly (not via submission approval), notify other admins
      if (addedByAdmin) {
        await this.notifyAdminsOfDirectContent({
          title: video.title,
          contentType: 'videos',
          addedBy: addedByAdmin.uid,
          addedByName: addedByAdmin.name || addedByAdmin.email,
        });
      }
      
      return videoRef.key!;
    } catch (error) {
      console.error('Error creating video:', error);
      throw error;
    }
  }
  
  // Notify ALL admins when an admin directly adds content
  private async notifyAdminsOfDirectContent(params: {
    title: string;
    contentType: 'notes' | 'videos';
    addedBy: string;
    addedByName?: string;
  }): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      const adderDisplay = params.addedByName || 'An admin';
      
      for (const admin of admins) {
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        // Notify ALL admins
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: 'admin_content_added',
            title: 'New Content Added',
            message: `${adderDisplay} added a new ${params.contentType === 'notes' ? 'note' : 'video'}: "${params.title}".`,
            contentType: params.contentType,
            fromUser: params.addedBy,
            fromUserName: params.addedByName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying admins of direct content:', error);
    }
  }

  async deleteVideo(videoId: string, semester: string, subjectId: string, scheme?: string): Promise<void> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('videos', schemeToUse);
      const videoRef = ref(database, `${basePath}/${semester}/${subjectId}/${videoId}`);
      await remove(videoRef);
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  // Pending Submissions operations
  async createPendingSubmission(submission: InsertPendingSubmission): Promise<string> {
    try {
      const pendingRef = push(ref(database, 'pendingSubmissions'));
      const now = Date.now();
      const pendingData: PendingSubmission = {
        ...submission,
        id: pendingRef.key!,
        scheme: (submission as any).scheme || currentScheme,
        submittedAt: now,
        expiresAt: now + PENDING_EXPIRY_MS, // 30 days from now
        status: "pending",
      };
      
      await set(pendingRef, pendingData);
      return pendingRef.key!;
    } catch (error) {
      console.error('Error creating pending submission:', error);
      throw error;
    }
  }

  async getPendingSubmissions(): Promise<PendingSubmission[]> {
    try {
      const snap = await get(ref(database, 'pendingSubmissions'));
      const val = snap.val();
      if (!val) return [];
      
      const now = Date.now();
      const submissions: PendingSubmission[] = [];
      
      for (const [id, data] of Object.entries(val as Record<string, any>)) {
        // Skip expired submissions
        if (data.expiresAt && data.expiresAt < now) {
          // Auto-delete expired submissions
          await remove(ref(database, `pendingSubmissions/${id}`));
          continue;
        }
        
        submissions.push({
          id,
          scheme: data.scheme || '2019',
          semester: data.semester,
          subjectId: data.subjectId,
          title: data.title,
          url: data.url,
          description: data.description || '',
          contentType: data.contentType,
          submittedBy: data.submittedBy || '',
          submitterName: data.submitterName,
          submitterEmail: data.submitterEmail,
          submittedAt: data.submittedAt,
          expiresAt: data.expiresAt,
          status: data.status || 'pending',
        });
      }
      
      return submissions.sort((a, b) => b.submittedAt - a.submittedAt);
    } catch (error) {
      console.error('Error getting pending submissions:', error);
      return [];
    }
  }

  async approvePendingSubmission(submissionId: string, approvedBy?: string, approvedByName?: string): Promise<void> {
    try {
      // Get the pending submission
      const snap = await get(ref(database, `pendingSubmissions/${submissionId}`));
      const submission = snap.val() as PendingSubmission | null;
      
      if (!submission) {
        throw new Error('Submission not found');
      }
      
      const scheme = submission.scheme || currentScheme;
      
      // Create the actual content based on type
      if (submission.contentType === 'notes') {
        await this.createNote({
          semester: submission.semester,
          subjectId: submission.subjectId,
          title: submission.title,
          description: submission.description || `Submitted by ${submission.submitterName || 'Anonymous'}`,
          url: submission.url,
          uploadedBy: submission.submittedBy,
          category: 'notes',
          scheme,
        } as any);
      } else {
        await this.createVideo({
          semester: submission.semester,
          subjectId: submission.subjectId,
          title: submission.title,
          description: submission.description || `Submitted by ${submission.submitterName || 'Anonymous'}`,
          url: submission.url,
          uploadedBy: submission.submittedBy,
          category: 'videos',
          scheme,
        } as any);
      }
      
      // Notify the submitter that their content was approved
      if (submission.submittedBy) {
        await this.createNotification({
          userId: submission.submittedBy,
          type: 'submission_approved',
          title: 'Submission Approved! 🎉',
          message: `Your ${submission.contentType === 'notes' ? 'note' : 'video'} "${submission.title}" has been approved and is now live.`,
          contentType: submission.contentType,
          fromUser: approvedBy,
          fromUserName: approvedByName,
        });
      }
      
      // Notify other admins about the approval (not the approver)
      await this.notifyAdminsOfContentApproval({
        submission,
        approvedBy,
        approvedByName,
      });
      
      // Remove the pending submission
      await remove(ref(database, `pendingSubmissions/${submissionId}`));
    } catch (error) {
      console.error('Error approving submission:', error);
      throw error;
    }
  }
  
  // Notify ALL admins when content is approved
  private async notifyAdminsOfContentApproval(params: {
    submission: PendingSubmission;
    approvedBy?: string;
    approvedByName?: string;
  }): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      const approverDisplay = params.approvedByName || params.approvedBy || 'An admin';
      
      for (const admin of admins) {
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        // Notify ALL admins
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: 'content_approved',
            title: 'Content Approved',
            message: `${approverDisplay} approved "${params.submission.title}" (${params.submission.contentType}) submitted by ${params.submission.submitterName || 'Anonymous'}.`,
            contentType: params.submission.contentType,
            fromUser: params.approvedBy,
            fromUserName: params.approvedByName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying admins of content approval:', error);
    }
  }

  async rejectPendingSubmission(submissionId: string, rejectedBy?: string, rejectedByName?: string, reason?: string): Promise<void> {
    try {
      // Get the submission first to notify the submitter
      const snap = await get(ref(database, `pendingSubmissions/${submissionId}`));
      const submission = snap.val() as PendingSubmission | null;
      
      if (!submission) {
        throw new Error('Submission not found');
      }
      
      // Only notify the original submitter (not admins with this message)
      if (submission.submittedBy) {
        await this.createNotification({
          userId: submission.submittedBy,
          type: 'submission_rejected',
          title: 'Submission Not Approved',
          message: `Your ${submission.contentType === 'notes' ? 'note' : 'video'} "${submission.title}" was not approved.${reason ? ` Reason: ${reason}` : ''} You can try submitting again with improvements.`,
          contentType: submission.contentType,
          fromUser: rejectedBy,
          fromUserName: rejectedByName,
        });
      }
      
      // Notify OTHER admins about the rejection (different message, different notification type)
      await this.notifyAdminsOfContentRejection({
        submission,
        rejectedBy,
        rejectedByName,
        reason,
      });
      
      await remove(ref(database, `pendingSubmissions/${submissionId}`));
    } catch (error) {
      console.error('Error rejecting submission:', error);
      throw error;
    }
  }
  
  // Notify ALL admins when content is rejected (NOT the user notification)
  private async notifyAdminsOfContentRejection(params: {
    submission: PendingSubmission;
    rejectedBy?: string;
    rejectedByName?: string;
    reason?: string;
  }): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      const rejecterDisplay = params.rejectedByName || params.rejectedBy || 'An admin';
      
      for (const admin of admins) {
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        // Notify ALL admins
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: 'submission_rejected', // This goes to admin, but message is different
            title: 'Submission Rejected',
            message: `${rejecterDisplay} rejected "${params.submission.title}" (${params.submission.contentType}) submitted by ${params.submission.submitterName || 'Anonymous'}.${params.reason ? ` Reason: ${params.reason}` : ''}`,
            contentType: params.submission.contentType,
            fromUser: params.rejectedBy,
            fromUserName: params.rejectedByName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying admins of content rejection:', error);
    }
  }

  async cleanupExpiredSubmissions(): Promise<number> {
    try {
      const snap = await get(ref(database, 'pendingSubmissions'));
      const val = snap.val();
      if (!val) return 0;
      
      const now = Date.now();
      let deletedCount = 0;
      
      for (const [id, data] of Object.entries(val as Record<string, any>)) {
        if (data.expiresAt && data.expiresAt < now) {
          await remove(ref(database, `pendingSubmissions/${id}`));
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired submissions:', error);
      return 0;
    }
  }

  // ==================== NOTIFICATION OPERATIONS ====================
  
  // Helper to send push notification via server (works even when app is closed)
  private async sendServerPushNotification(notification: InsertAppNotification): Promise<void> {
    try {
      // Send via server-side web-push API for reliable background delivery
      await fetch('/api/push/send-to-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: notification.userId,
          payload: {
            type: notification.type,
            title: notification.title,
            message: notification.message,
            url: '/',
            contentId: notification.contentId,
            contentType: notification.contentType,
          }
        })
      });
    } catch (error) {
      console.error('Error sending server push notification:', error);
      // Fallback to local notification if server push fails and page is open
      await this.sendLocalBrowserNotification(notification);
    }
  }

  // Fallback for local browser notification (only works when page is open)
  private async sendLocalBrowserNotification(notification: InsertAppNotification): Promise<void> {
    // Check if we have permission and the API is available
    if (typeof window === 'undefined' || !('Notification' in window) || window.Notification.permission !== 'granted') {
      return;
    }

    try {
      // Create a browser notification
      const options: NotificationOptions = {
        body: notification.message,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: notification.contentId || 'general',
        silent: false,
        data: {
          url: '/',
          type: notification.type,
        }
      };

      // Use service worker for background notifications if available
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(notification.title, options);
      } else {
        // Fallback to regular notification
        new Notification(notification.title, options);
      }
    } catch (error) {
      console.error('Error sending local browser notification:', error);
    }
  }

  async createNotification(notification: InsertAppNotification): Promise<string> {
    try {
      const notifRef = push(ref(database, `notifications/${notification.userId}`));
      const notifData: AppNotification = {
        ...notification,
        id: notifRef.key!,
        read: false,
        createdAt: Date.now(),
      };
      await set(notifRef, notifData);
      
      // Send push notification via server (works even when app is closed)
      await this.sendServerPushNotification(notification);
      
      return notifRef.key!;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<AppNotification[]> {
    try {
      const snap = await get(ref(database, `notifications/${userId}`));
      const val = snap.val();
      if (!val) return [];
      
      const notifications: AppNotification[] = Object.entries(val as Record<string, any>).map(([id, data]) => ({
        id,
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        contentId: data.contentId,
        contentType: data.contentType,
        fromUser: data.fromUser,
        fromUserName: data.fromUserName,
        read: data.read || false,
        createdAt: data.createdAt,
      }));
      
      return notifications.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const notifications = await this.getUserNotifications(userId);
      return notifications.filter(n => !n.read).length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await set(ref(database, `notifications/${userId}/${notificationId}/read`), true);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const notifications = await this.getUserNotifications(userId);
      await Promise.all(
        notifications.filter(n => !n.read).map(n => 
          set(ref(database, `notifications/${userId}/${n.id}/read`), true)
        )
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    try {
      await remove(ref(database, `notifications/${userId}/${notificationId}`));
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // ==================== PUSH NOTIFICATION OPERATIONS ====================

  /**
   * Get VAPID public key from server
   */
  async getVapidPublicKey(): Promise<string> {
    try {
      const response = await fetch('/api/push/vapid-public-key');
      const data = await response.json();
      return data.publicKey;
    } catch (error) {
      console.error('Error getting VAPID key:', error);
      throw error;
    }
  }

  /**
   * Subscribe current browser to push notifications
   */
  async subscribeToPushNotifications(userId: string): Promise<boolean> {
    try {
      // Check if push notifications are supported
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Get VAPID public key
        const vapidPublicKey = await this.getVapidPublicKey();
        
        // Convert VAPID key to Uint8Array
        const urlBase64ToUint8Array = (base64String: string) => {
          const padding = '='.repeat((4 - base64String.length % 4) % 4);
          const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        // Subscribe to push notifications
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // Save subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription');
      }

      console.log('Successfully subscribed to push notifications');
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
    try {
      if (!('serviceWorker' in navigator)) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe();

        // Remove from server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            endpoint: subscription.endpoint
          })
        });
      }

      console.log('Successfully unsubscribed from push notifications');
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }

  /**
   * Broadcast push notification to all subscribed users
   */
  async broadcastPushNotification(notification: {
    type: string;
    title: string;
    message: string;
    url?: string;
    contentId?: string;
    contentType?: string;
    excludeUserId?: string;
  }): Promise<{ sent: number; failed: number }> {
    try {
      const response = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });

      if (!response.ok) {
        throw new Error('Failed to broadcast notification');
      }

      const result = await response.json();
      console.log('Broadcast complete:', result);
      return { sent: result.sent || 0, failed: result.failed || 0 };
    } catch (error) {
      console.error('Error broadcasting push notification:', error);
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * Notify ALL admins about admin panel activity (content added, etc.)
   * Every admin receives the notification, including the one who performed the action
   */
  async notifyAdminsOfActivity(activity: {
    type: AppNotification['type'];
    title: string;
    message: string;
    contentId?: string;
    contentType?: 'notes' | 'videos';
    performedBy?: string;
    performedByName?: string;
    excludeUserId?: string; // Optional: only use if you specifically want to exclude someone
  }): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      for (const admin of admins) {
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        // Notify ALL admins (only exclude if explicitly specified AND excludeUserId is set)
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: activity.type as AppNotification['type'],
            title: activity.title,
            message: activity.message,
            contentId: activity.contentId,
            contentType: activity.contentType,
            fromUser: activity.performedBy,
            fromUserName: activity.performedByName,
          });
        }
      }
      console.log('Notified ALL admins of activity:', activity.type);
    } catch (error) {
      console.error('Error notifying admins of activity:', error);
    }
  }

  /**
   * Notify a specific user about an action on their content
   */
  async notifyUserOfContentAction(userId: string, action: {
    type: AppNotification['type'];
    title: string;
    message: string;
    contentId?: string;
    contentType?: 'notes' | 'videos';
    fromUser?: string;
    fromUserName?: string;
  }): Promise<void> {
    try {
      await this.createNotification({
        userId,
        type: action.type as AppNotification['type'],
        title: action.title,
        message: action.message,
        contentId: action.contentId,
        contentType: action.contentType,
        fromUser: action.fromUser,
        fromUserName: action.fromUserName,
      });
      console.log('Notified user:', userId, 'of action:', action.type);
    } catch (error) {
      console.error('Error notifying user of content action:', error);
    }
  }

  // Notify all admins about new pending submission
  async notifyAdminsOfPendingSubmission(submission: PendingSubmission): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      for (const admin of admins) {
        // Find the user ID for this admin email
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: 'pending_approval',
            title: 'New Submission Pending',
            message: `"${submission.title}" submitted by ${submission.submitterName || 'Anonymous'} is awaiting approval.`,
            contentId: submission.id,
            contentType: submission.contentType,
            fromUser: submission.submittedBy,
            fromUserName: submission.submitterName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying admins:', error);
    }
  }

  // Listen for real-time notification updates
  onNotificationsChange(userId: string, callback: (notifications: AppNotification[]) => void): () => void {
    const notifRef = ref(database, `notifications/${userId}`);
    
    const listener = (snapshot: any) => {
      const val = snapshot.val();
      if (!val) {
        callback([]);
        return;
      }
      
      const notifications: AppNotification[] = Object.entries(val as Record<string, any>).map(([id, data]) => ({
        id,
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        contentId: data.contentId,
        contentType: data.contentType,
        fromUser: data.fromUser,
        fromUserName: data.fromUserName,
        read: data.read || false,
        createdAt: data.createdAt,
      }));
      
      callback(notifications.sort((a, b) => b.createdAt - a.createdAt));
    };
    
    onValue(notifRef, listener);
    return () => off(notifRef, 'value', listener);
  }

  // ==================== RATING OPERATIONS ====================

  async createOrUpdateRating(rating: InsertRating): Promise<string> {
    try {
      // Check if user already rated this content
      const existingRating = await this.getUserRatingForContent(rating.userId, rating.contentId, rating.contentType);
      
      if (existingRating) {
        // Update existing rating
        const ratingPath = `ratings/${rating.contentType}/${rating.semester}/${rating.subjectId}/${rating.contentId}/${existingRating.id}`;
        await set(ref(database, ratingPath), {
          ...existingRating,
          rating: rating.rating,
          updatedAt: Date.now(),
        });
        return existingRating.id;
      } else {
        // Create new rating
        const ratingRef = push(ref(database, `ratings/${rating.contentType}/${rating.semester}/${rating.subjectId}/${rating.contentId}`));
        const ratingData: Rating = {
          ...rating,
          id: ratingRef.key!,
          createdAt: Date.now(),
        };
        await set(ratingRef, ratingData);
        
        // Notify the content uploader
        await this.notifyContentOwnerOfRating(rating, ratingData.id);
        
        return ratingRef.key!;
      }
    } catch (error) {
      console.error('Error creating/updating rating:', error);
      throw error;
    }
  }

  async getUserRatingForContent(userId: string, contentId: string, contentType: 'notes' | 'videos'): Promise<Rating | null> {
    try {
      // We need to search through ratings to find this user's rating
      // This is a bit inefficient, but works for now
      const ratingsSnap = await get(ref(database, `ratings/${contentType}`));
      const semesterData = ratingsSnap.val();
      if (!semesterData) return null;
      
      for (const [semester, subjectData] of Object.entries(semesterData as Record<string, any>)) {
        if (!subjectData) continue;
        for (const [subjectId, contentData] of Object.entries(subjectData as Record<string, any>)) {
          if (!contentData) continue;
          const contentRatings = contentData[contentId];
          if (!contentRatings) continue;
          
          for (const [ratingId, ratingData] of Object.entries(contentRatings as Record<string, any>)) {
            if (ratingData.userId === userId) {
              return {
                id: ratingId,
                scheme: ratingData.scheme || currentScheme,
                contentId,
                contentType,
                semester,
                subjectId,
                userId: ratingData.userId,
                userName: ratingData.userName,
                rating: ratingData.rating,
                createdAt: ratingData.createdAt,
                updatedAt: ratingData.updatedAt,
              };
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting user rating:', error);
      return null;
    }
  }

  async getContentRatings(contentId: string, contentType: 'notes' | 'videos', semester: string, subjectId: string): Promise<Rating[]> {
    try {
      const snap = await get(ref(database, `ratings/${contentType}/${semester}/${subjectId}/${contentId}`));
      const val = snap.val();
      if (!val) return [];
      
      return Object.entries(val as Record<string, any>).map(([id, data]) => ({
        id,
        scheme: data.scheme || currentScheme,
        contentId,
        contentType,
        semester,
        subjectId,
        userId: data.userId,
        userName: data.userName,
        rating: data.rating,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }));
    } catch (error) {
      console.error('Error getting content ratings:', error);
      return [];
    }
  }

  async getAverageRating(contentId: string, contentType: 'notes' | 'videos', semester: string, subjectId: string): Promise<{ average: number; count: number }> {
    try {
      const ratings = await this.getContentRatings(contentId, contentType, semester, subjectId);
      if (ratings.length === 0) return { average: 0, count: 0 };
      
      const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
      return { average: sum / ratings.length, count: ratings.length };
    } catch (error) {
      console.error('Error getting average rating:', error);
      return { average: 0, count: 0 };
    }
  }

  private async notifyContentOwnerOfRating(rating: InsertRating, ratingId: string): Promise<void> {
    try {
      // Get the content to find the owner
      const contentPath = rating.contentType === 'notes' 
        ? `notes/${rating.semester}/${rating.subjectId}/${rating.contentId}`
        : `videos/${rating.semester}/${rating.subjectId}/${rating.contentId}`;
      
      const contentSnap = await get(ref(database, contentPath));
      const content = contentSnap.val();
      
      if (content && content.uploadedBy && content.uploadedBy !== rating.userId) {
        // Find the owner's user ID
        const allUsers = await this.getAllUsers();
        const owner = allUsers.find(u => u.uid === content.uploadedBy || u.email === content.uploadedBy);
        
        if (owner) {
          await this.createNotification({
            userId: owner.uid,
            type: 'content_rated',
            title: 'Your Content Was Rated',
            message: `${rating.userName || 'Someone'} rated your ${rating.contentType === 'notes' ? 'note' : 'video'} "${content.title}" with ${rating.rating} stars.`,
            contentId: rating.contentId,
            contentType: rating.contentType,
            fromUser: rating.userId,
            fromUserName: rating.userName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying content owner of rating:', error);
    }
  }

  // ==================== REPORT OPERATIONS ====================

  async createReport(report: InsertReport): Promise<string> {
    try {
      const reportRef = push(ref(database, 'reports'));
      const reportData: Report = {
        ...report,
        id: reportRef.key!,
        status: 'pending',
        createdAt: Date.now(),
      };
      await set(reportRef, reportData);
      
      // Notify admins of the new report
      await this.notifyAdminsOfReport(reportData);
      
      return reportRef.key!;
    } catch (error) {
      console.error('Error creating report:', error);
      throw error;
    }
  }

  async getReports(status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'): Promise<Report[]> {
    try {
      const snap = await get(ref(database, 'reports'));
      const val = snap.val();
      if (!val) return [];
      
      let reports: Report[] = Object.entries(val as Record<string, any>).map(([id, data]) => ({
        id,
        scheme: data.scheme || currentScheme,
        contentId: data.contentId,
        contentType: data.contentType,
        semester: data.semester,
        subjectId: data.subjectId,
        contentTitle: data.contentTitle,
        contentUploadedBy: data.contentUploadedBy,
        reportedBy: data.reportedBy,
        reporterName: data.reporterName,
        reporterEmail: data.reporterEmail,
        reason: data.reason,
        description: data.description,
        status: data.status || 'pending',
        adminNotes: data.adminNotes,
        reviewedBy: data.reviewedBy,
        reviewedAt: data.reviewedAt,
        createdAt: data.createdAt,
      }));
      
      if (status) {
        reports = reports.filter(r => r.status === status);
      }
      
      return reports.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('Error getting reports:', error);
      return [];
    }
  }

  async updateReportStatus(
    reportId: string, 
    status: 'reviewed' | 'resolved' | 'dismissed',
    adminNotes?: string,
    reviewedBy?: string,
    reviewedByName?: string
  ): Promise<void> {
    try {
      const updates: Record<string, any> = {
        status,
        reviewedAt: Date.now(),
      };
      if (adminNotes) updates.adminNotes = adminNotes;
      if (reviewedBy) updates.reviewedBy = reviewedBy;
      
      const reportRef = ref(database, `reports/${reportId}`);
      const snap = await get(reportRef);
      const current = snap.val();
      
      await set(reportRef, { ...current, ...updates });
      
      // Notify the reporter about the status change
      if (current?.reportedBy) {
        const allUsers = await this.getAllUsers();
        const reporter = allUsers.find(u => u.uid === current.reportedBy || u.email === current.reportedBy);
        
        if (reporter) {
          const statusMessages: Record<string, string> = {
            reviewed: 'is being reviewed by our team',
            resolved: 'has been resolved. Thank you for helping keep our content clean!',
            dismissed: 'has been reviewed and no action was required',
          };
          
          await this.createNotification({
            userId: reporter.uid,
            type: 'content_reported',
            title: 'Report Status Updated',
            message: `Your report on "${current.contentTitle}" ${statusMessages[status]}.`,
            contentId: current.contentId,
            contentType: current.contentType,
          });
        }
      }
      
      // Notify other admins about the report review
      await this.notifyAdminsOfReportReview({
        report: current,
        status,
        reviewedBy,
        reviewedByName,
        adminNotes,
      });
    } catch (error) {
      console.error('Error updating report status:', error);
      throw error;
    }
  }
  
  // Notify ALL admins when a report is reviewed
  private async notifyAdminsOfReportReview(params: {
    report: Report;
    status: string;
    reviewedBy?: string;
    reviewedByName?: string;
    adminNotes?: string;
  }): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      const reviewerDisplay = params.reviewedByName || params.reviewedBy || 'An admin';
      const statusDisplay = params.status === 'resolved' ? 'resolved' : params.status === 'dismissed' ? 'dismissed' : 'reviewed';
      
      for (const admin of admins) {
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        // Notify ALL admins
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: 'report_reviewed',
            title: 'Report Reviewed',
            message: `${reviewerDisplay} ${statusDisplay} a report on "${params.report.contentTitle}" (${params.report.reason}).${params.adminNotes ? ` Notes: ${params.adminNotes}` : ''}`,
            contentId: params.report.contentId,
            contentType: params.report.contentType,
            fromUser: params.reviewedBy,
            fromUserName: params.reviewedByName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying admins of report review:', error);
    }
  }

  async deleteReport(reportId: string): Promise<void> {
    try {
      await remove(ref(database, `reports/${reportId}`));
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }

  async hasUserReportedContent(userId: string, contentId: string): Promise<boolean> {
    try {
      const reports = await this.getReports();
      return reports.some(r => r.reportedBy === userId && r.contentId === contentId);
    } catch (error) {
      console.error('Error checking user report:', error);
      return false;
    }
  }

  private async notifyAdminsOfReport(report: Report): Promise<void> {
    try {
      const admins = await this.getAdmins();
      const allUsers = await this.getAllUsers();
      
      for (const admin of admins) {
        const adminUser = allUsers.find(u => u.email.toLowerCase() === admin.email.toLowerCase());
        if (adminUser) {
          await this.createNotification({
            userId: adminUser.uid,
            type: 'content_reported',
            title: 'New Content Report',
            message: `"${report.contentTitle}" was reported for: ${report.reason}${report.description ? ` - "${report.description}"` : ''}`,
            contentId: report.contentId,
            contentType: report.contentType,
            fromUser: report.reportedBy,
            fromUserName: report.reporterName,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying admins of report:', error);
    }
  }

  // Get pending reports count for admin badge
  async getPendingReportsCount(): Promise<number> {
    try {
      const reports = await this.getReports('pending');
      return reports.length;
    } catch (error) {
      console.error('Error getting pending reports count:', error);
      return 0;
    }
  }

  /**
   * Fetch all notes and videos for a semester with only two reads, and flatten to ContentItem[]
   */
  async getAllContentForSemester(semester: string, scheme?: string): Promise<ContentItem[]> {
    try {
      const schemeToUse = scheme || currentScheme;
      const notesPath = this.getSchemeBasePath('notes', schemeToUse);
      const videosPath = this.getSchemeBasePath('videos', schemeToUse);
      
      const [notesSnap, videosSnap] = await Promise.all([
        get(ref(database, `${notesPath}/${semester}`)),
        get(ref(database, `${videosPath}/${semester}`)),
      ]);

      const results: ContentItem[] = [];

      const notesBySubject = (notesSnap.val() || {}) as Record<string, any>;
      Object.entries(notesBySubject).forEach(([subjectId, byId]) => {
        if (!byId || typeof byId !== 'object') return;
        Object.entries(byId as Record<string, any>).forEach(([id, val]) => {
          if (!val) return;
          results.push({
            id,
            scheme: schemeToUse,
            semester,
            subjectId,
            title: val.title || id,
            url: val.link || val.url || '',
            uploadedBy: val.addedBy || '',
            timestamp: val.addedAt || val.timestamp || 0,
            downloads: typeof val.downloads === 'number' ? val.downloads : 0,
            description: val.description || '',
            category: 'notes',
          } as Note);
        });
      });

      const videosBySubject = (videosSnap.val() || {}) as Record<string, any>;
      Object.entries(videosBySubject).forEach(([subjectId, byId]) => {
        if (!byId || typeof byId !== 'object') return;
        Object.entries(byId as Record<string, any>).forEach(([id, val]) => {
          if (!val) return;
          results.push({
            id,
            scheme: schemeToUse,
            semester,
            subjectId,
            title: val.title || id,
            url: val.link || val.url || '',
            uploadedBy: val.addedBy || '',
            timestamp: val.addedAt || val.timestamp || 0,
            views: typeof val.views === 'number' ? val.views : 0,
            description: val.description || '',
            category: 'videos',
          } as Video);
        });
      });

      return results.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      console.error('Error fetching semester content:', e);
      return [];
    }
  }

  /**
   * Update or move a content item. Supports changing title/description/url and moving across
   * semester/subject and switching category between notes/videos. Keeps same id when moving.
   */
  async updateContent(
    item: ContentItem,
    updates: Partial<{ scheme: string; semester: string; subjectId: string; category: 'notes' | 'videos'; title: string; description: string; url: string }>
  ): Promise<void> {
    const fromCategory = item.category;
    const toCategory = updates.category || fromCategory;
    const fromSem = item.semester;
    const toSem = updates.semester || fromSem;
    const fromSubject = item.subjectId;
    const toSubject = updates.subjectId || fromSubject;
    const fromScheme = (item as any).scheme || currentScheme;
    const toScheme = updates.scheme || fromScheme;

    // read current snapshot to merge counters and existing fields
    const fromBasePath = this.getSchemeBasePath(fromCategory, fromScheme);
    const fromPath = `${fromBasePath}/${fromSem}/${fromSubject}/${item.id}`;
    const snap = await get(ref(database, fromPath));
    const current = (snap.val() || {}) as any;

    // Build new record based on target category
    if (toCategory === 'notes') {
      const newNote: Note = {
        id: item.id,
        scheme: toScheme,
        semester: toSem,
        subjectId: toSubject,
        title: updates.title ?? item.title,
        description: updates.description ?? (item.description || ''),
        url: updates.url ?? (item as any).url ?? current.url ?? '',
        uploadedBy: (current.uploadedBy ?? item.uploadedBy) || '',
        timestamp: typeof current.timestamp === 'number' ? current.timestamp : item.timestamp,
        downloads: typeof current.downloads === 'number' ? current.downloads : (item as any).downloads || 0,
        category: 'notes',
      };
      const toBasePath = this.getSchemeBasePath('notes', toScheme);
      const toPath = `${toBasePath}/${toSem}/${toSubject}/${item.id}`;
      await set(ref(database, toPath), newNote);
    } else {
      const newVideo: Video = {
        id: item.id,
        scheme: toScheme,
        semester: toSem,
        subjectId: toSubject,
        title: updates.title ?? item.title,
        description: updates.description ?? (item.description || ''),
        url: updates.url ?? (item as any).url ?? current.url ?? '',
        uploadedBy: (current.uploadedBy ?? item.uploadedBy) || '',
        timestamp: typeof current.timestamp === 'number' ? current.timestamp : item.timestamp,
        views: typeof current.views === 'number' ? current.views : (item as any).views || 0,
        category: 'videos',
      };
      const toBasePath = this.getSchemeBasePath('videos', toScheme);
      const toPath = `${toBasePath}/${toSem}/${toSubject}/${item.id}`;
      await set(ref(database, toPath), newVideo);
    }

    // Remove from old location if path, category, or scheme changed
    if (fromCategory !== toCategory || fromSem !== toSem || fromSubject !== toSubject || fromScheme !== toScheme) {
      await remove(ref(database, fromPath));
    }
  }

  async incrementDownload(item: { id: string; semester: string; subjectId: string; scheme?: string }): Promise<void> {
    try {
      const schemeToUse = item.scheme || currentScheme;
      const basePath = this.getSchemeBasePath('notes', schemeToUse);
    const path = `${basePath}/${item.semester}/${item.subjectId}/${item.id}`;
    const noteRef = ref(database, path);
    const snapshot = await get(noteRef);
    const noteData = snapshot.val() as any;
    const current = noteData && typeof noteData.downloads === 'number' ? noteData.downloads : 0;
    await set(ref(database, `${path}/downloads`), current + 1);
    } catch (error) {
      console.error('Error incrementing download:', error);
    }
  }

  async incrementView(item: { id: string; semester: string; subjectId: string; scheme?: string }): Promise<void> {
    try {
      const schemeToUse = item.scheme || currentScheme;
      const basePath = this.getSchemeBasePath('videos', schemeToUse);
    const path = `${basePath}/${item.semester}/${item.subjectId}/${item.id}`;
    const videoRef = ref(database, path);
    const snapshot = await get(videoRef);
    const videoData = snapshot.val() as any;
    const current = videoData && typeof videoData.views === 'number' ? videoData.views : 0;
    await set(ref(database, `${path}/views`), current + 1);
    } catch (error) {
      console.error('Error incrementing view:', error);
    }
  }

  // User operations
  async createUser(user: User): Promise<void> {
    try {
      const userRef = ref(database, `users/${user.uid}`);
      await set(userRef, user);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async upsertUser(user: User): Promise<void> {
    try {
      const userRef = ref(database, `users/${user.uid}`);
      await set(userRef, user);
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async getUser(uid: string): Promise<User | null> {
    try {
      const userRef = ref(database, `users/${uid}`);
      const snapshot = await get(userRef);
      return snapshot.val() as User || null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  async getAdminRoleByEmail(email?: string | null): Promise<"superadmin" | "admin" | null> {
    if (!email) return null;
    try {
      // Check config permanent admin first
      const configSnap = await get(ref(database, 'config/permanentAdmin'));
      const permanent = configSnap.val();
      if (typeof permanent === 'string' && permanent.toLowerCase() === email.toLowerCase()) {
        return "superadmin";
      }

      const adminsSnap = await get(ref(database, 'admins'));
      const adminsVal = adminsSnap.val();
      if (adminsVal) {
        // Case 1: Array of strings or objects
        if (Array.isArray(adminsVal)) {
          for (const entry of adminsVal) {
            if (!entry) continue;
            if (typeof entry === 'string' && entry.toLowerCase() === email.toLowerCase()) return 'admin';
            const entryEmail = entry.email || entry.userEmail || entry.user_email;
            if (entryEmail && String(entryEmail).toLowerCase() === email.toLowerCase()) {
              const roleRaw = entry.role || 'admin';
              const role = String(roleRaw).toLowerCase();
              if (role.includes('super')) return 'superadmin';
              return 'admin';
            }
          }
        } else if (typeof adminsVal === 'object') {
          // Case 2: Object keyed by push ids OR by email
          for (const [k, v] of Object.entries(adminsVal as Record<string, any>)) {
            if (!v && typeof k === 'string') continue;
            // If key itself is an email
            if (k.includes('@')) {
              // value might be true/"admin"/"superadmin"/1
              if (k.toLowerCase() === email.toLowerCase()) {
                const roleVal = typeof v === 'string' ? v.toLowerCase() : (v && v.role ? String(v.role).toLowerCase() : 'admin');
                if (roleVal.includes('super')) return 'superadmin';
                return 'admin';
              }
            }
            // Otherwise treat v as entry object
            if (v) {
              if (typeof v === 'string') {
                if (v.toLowerCase() === email.toLowerCase()) return 'admin';
              } else {
                const e = v as any;
                const entryEmail = e.email || e.userEmail || e.user_email;
                if (entryEmail && String(entryEmail).toLowerCase() === email.toLowerCase()) {
                  const roleRaw = e.role || 'admin';
                  const role = String(roleRaw).toLowerCase();
                  if (role.includes('super')) return 'superadmin';
                  return 'admin';
                }
              }
            }
          }
        }
      }
      return null;
    } catch (e) {
      console.error('Error checking admin role:', e);
      return null;
    }
  }

  // Subject operations
  async getSubjects(semester: string, scheme?: string): Promise<Record<string, Subject>> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('subjects', schemeToUse);
      const subjectsRef = ref(database, `${basePath}/${semester}`);
      const snapshot = await get(subjectsRef);
      const data = snapshot.val();

      if (!data) return {};

      // Two possible shapes in the DB:
      // 1) Object of subjects keyed by an id with fields: id, name, code, semester
      // 2) Array of { key, name } entries
      if (Array.isArray(data)) {
        // Convert array of { key, name } into Subject map with minimal fields
        const map: Record<string, Subject> = {};
        data.forEach((entry: any) => {
          if (!entry || !entry.key) return;
          const id = entry.key;
          map[id] = {
            name: entry.name || id,
            credit: 0,
            grade: "",
            notes: [],
            videos: [],
          } as Subject;
        });
        return map;
      }

  // If it's an object, normalize values to Subject shape if possible
      const result: Record<string, Subject> = {};
      Object.entries(data as Record<string, any>).forEach(([id, value]) => {
        if (!value) return;
        // If already in expected shape, keep it
        if (
          typeof value === "object" &&
          "name" in value &&
          "credit" in value &&
          "grade" in value
        ) {
          result[id] = {
            name: value.name,
            credit: value.credit ?? 0,
            grade: value.grade ?? "",
            notes: Array.isArray(value.notes) ? value.notes : [],
            videos: Array.isArray(value.videos) ? value.videos : [],
          };
  } else {
          result[id] = {
            name: value.name || value.title || id,
            credit: value.credit ?? 0,
            grade: value.grade ?? "",
            notes: [],
            videos: [],
          } as Subject;
        }
      });
      return result;
    } catch (error) {
      console.error('Error getting subjects:', error);
      return {};
    }
  }

  async updateSubject(semester: string, subjectId: string, subject: Partial<Subject>, scheme?: string): Promise<void> {
    try {
      const schemeToUse = scheme || currentScheme;
      const basePath = this.getSchemeBasePath('subjects', schemeToUse);
      const subjectRef = ref(database, `${basePath}/${semester}/${subjectId}`);
      const snapshot = await get(subjectRef);
      const currentData = snapshot.val() || {};
      await set(subjectRef, { ...currentData, ...subject });
    } catch (error) {
      console.error('Error updating subject:', error);
      throw error;
    }
  }

  // Initialize database with default subjects
  async initializeSubjects(): Promise<void> {
    try {
      const subjectsRef = ref(database, 'subjects');
      const snapshot = await get(subjectsRef);
      
      if (!snapshot.val()) {
        const { SEMESTERS } = await import('@shared/schema');
        await set(subjectsRef, SEMESTERS);
      }
    } catch (error) {
      console.error('Error initializing subjects:', error);
    }
  }

  // Realtime listeners
  onContentChange(semester: string, subjectId: string, category: "all" | "notes" | "videos", callback: (content: ContentItem[]) => void, scheme?: string): () => void {
    const schemeToUse = scheme || currentScheme;
    // In the provided DB, notes and videos are under /notes/<sem>/<subjectKey> and /videos/<sem>/<subjectKey>
    const paths: Array<{ type: "notes" | "videos"; refPath: string }> = [];
    const notesBasePath = this.getSchemeBasePath('notes', schemeToUse);
    const videosBasePath = this.getSchemeBasePath('videos', schemeToUse);
  if (category === "all" || category === "notes") paths.push({ type: "notes", refPath: `${notesBasePath}/${semester}/${subjectId}` });
  if (category === "all" || category === "videos") paths.push({ type: "videos", refPath: `${videosBasePath}/${semester}/${subjectId}` });

    let unsubscribers: Array<() => void> = [];
    const aggregateAndEmit = async () => {
      try {
        const combined: ContentItem[] = [];
        for (const p of paths) {
          const snap = await get(ref(database, p.refPath));
          const byKey = snap.val() || {};
          Object.entries(byKey).forEach(([id, val]: [string, any]) => {
            if (!val) return;
      if (p.type === "notes") {
              combined.push({
                id,
                scheme: schemeToUse,
                semester,
                subjectId,
                title: val.title || id,
                  url: val.link || val.url,
                uploadedBy: val.addedBy || "",
                timestamp: val.addedAt || 0,
        downloads: typeof val.downloads === 'number' ? val.downloads : 0,
                description: val.description || "",
                category: "notes",
              } as Note);
            } else {
              combined.push({
                id,
                scheme: schemeToUse,
                semester,
                subjectId,
                title: val.title || id,
                  url: val.link || val.url,
                uploadedBy: val.addedBy || "",
                timestamp: val.addedAt || 0,
        views: typeof val.views === 'number' ? val.views : 0,
                description: val.description || "",
                category: "videos",
              } as Video);
            }
          });
        }
        callback(combined.sort((a, b) => b.timestamp - a.timestamp));
      } catch (e) {
        console.error("Error aggregating content:", e);
        callback([]);
      }
    };

    // Set up listeners for both paths
    paths.forEach((p) => {
      const r = ref(database, p.refPath);
      const listener = () => aggregateAndEmit();
      onValue(r, listener);
      unsubscribers.push(() => off(r, 'value', listener));
    });

    // initial load
    aggregateAndEmit();

    return () => {
      unsubscribers.forEach((u) => u());
    };
  }

  onNotesChange(semester: string, subjectId: string, callback: (notes: Note[]) => void, scheme?: string): () => void {
    const schemeToUse = scheme || currentScheme;
    const basePath = this.getSchemeBasePath('notes', schemeToUse);
    const notesRef = ref(database, `${basePath}/${semester}/${subjectId}`);

    const listener = async (snapshot: any) => {
      const byKey = snapshot.val() || {};
      const notes: Note[] = Object.entries(byKey).map(([id, val]: [string, any]) => ({
        id,
        scheme: schemeToUse,
        semester,
        subjectId,
        title: (val && val.title) || id,
        url: val.link || val.url,
        uploadedBy: val.addedBy || "",
        timestamp: val.addedAt || 0,
        downloads: typeof val.downloads === 'number' ? val.downloads : 0,
        description: val.description || "",
        category: "notes",
      }));
      callback(notes.sort((a, b) => b.timestamp - a.timestamp));
    };

    onValue(notesRef, listener);
    return () => off(notesRef, 'value', listener);
  }

  // Admin operations
  async promoteToAdmin(uid: string): Promise<void> {
    try {
      // Update the role on the user record
      await set(ref(database, `users/${uid}/role`), "admin");

      // Also add an entry under admins for email-based role resolution
      const userSnap = await get(ref(database, `users/${uid}`));
      const u = userSnap.val() as User | null;
      if (u?.email) {
        const adminEntryRef = push(ref(database, 'admins'));
        await set(adminEntryRef, { email: u.email, role: 'admin', uid });
      }
    } catch (error) {
      console.error('Error promoting user to admin:', error);
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      const usersData = snapshot.val() || {};
      return Object.values(usersData) as User[];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  /**
   * Advanced search functionality for notes and videos
   * Supports text search, filtering, and sorting across all content
   */
  async searchContent(searchParams: {
    query?: string;
    scheme?: string;
    semester?: string;
    subject?: string;
    contentType?: "all" | "notes" | "videos";
    dateRange?: "all" | "week" | "month" | "year";
    sortBy?: "relevance" | "date" | "downloads" | "title";
    sortOrder?: "asc" | "desc";
  }): Promise<ContentItem[]> {
    try {
      const {
        query = "",
        scheme = currentScheme,
        semester = "all",
        subject = "all",
        contentType = "all",
        dateRange = "all",
        sortBy = "relevance",
        sortOrder = "desc"
      } = searchParams;

      // Support subject filter as combined key "sN-subjectId"
      let subjectSemester: string | null = null;
      let subjectIdFilter: string | null = null;
      if (subject !== "all" && subject.includes("-")) {
        const idx = subject.indexOf('-');
        subjectSemester = subject.slice(0, idx);
        subjectIdFilter = subject.slice(idx + 1);
      } else if (subject !== "all") {
        subjectIdFilter = subject;
      }

      // Determine which semesters to search
      const semestersToSearch = subjectSemester
        ? [subjectSemester]
        : (semester === "all" ? ['s1','s2','s3','s4','s5','s6','s7','s8'] : [semester]);

      // Fetch per-semester aggregated content and subject names in parallel for speed
      const perSemesterBatches = await Promise.all(
        semestersToSearch.map(async (sem) => {
          const [contentItems, subjectsMap] = await Promise.all([
            this.getAllContentForSemester(sem, scheme),
            this.getSubjects(sem, scheme),
          ]);

          // Map subject names for display/search
          const withSubjectNames = contentItems.map((item) => ({
            ...item,
            subjectName: (subjectsMap as any)[item.subjectId]?.name || '',
          }));

          return withSubjectNames;
        })
      );

      let allContent: ContentItem[] = ([] as ContentItem[]).concat(...perSemesterBatches);

      // Apply basic filters first (subject/contentType)
      if (subjectIdFilter) {
        allContent = allContent.filter((item) => item.subjectId === subjectIdFilter);
      }
      if (contentType !== "all") {
        allContent = allContent.filter((item) => item.category === contentType);
      }

      // Apply text search filter
  if (query.trim()) {
        const searchTerms = query.toLowerCase().trim().split(' ').filter(term => term.length > 0);
        allContent = allContent.filter(item => {
          const searchText = [
            item.title,
            item.description || "",
    (item as any).subjectName || "",
    item.url || ""
          ].join(' ').toLowerCase();

          return searchTerms.every(term => searchText.includes(term));
        });
      }

      // Apply date range filter
      if (dateRange !== "all") {
        const now = Date.now();
        const cutoffTime = this.getDateRangeCutoff(dateRange, now);
        allContent = allContent.filter(item => item.timestamp >= cutoffTime);
      }

      // Apply sorting
      allContent = this.sortContent(allContent, sortBy, sortOrder, query);

      return allContent;
    } catch (error) {
      console.error('Error searching content:', error);
      return [];
    }
  }

  /**
   * Get all available subjects across all semesters for search filtering
   */
  async getAllSubjects(scheme?: string): Promise<Record<string, { name: string; semester: string }>> {
    try {
      const schemeToUse = scheme || currentScheme;
      const allSubjects: Record<string, { name: string; semester: string }> = {};
      const semesters = ['s1','s2','s3','s4','s5','s6','s7','s8'];

      for (const semester of semesters) {
        const semesterSubjects = await this.getSubjects(semester, schemeToUse);
        Object.entries(semesterSubjects).forEach(([id, subject]) => {
          allSubjects[`${semester}-${id}`] = {
            name: subject.name,
            semester
          };
        });
      }
      
      return allSubjects;
    } catch (error) {
      console.error('Error getting all subjects:', error);
      return {};
    }
  }

  /**
   * Get cutoff timestamp for date range filtering
   */
  private getDateRangeCutoff(dateRange: string, now: number): number {
    switch (dateRange) {
      case "week":
        return now - (7 * 24 * 60 * 60 * 1000);
      case "month":
        return now - (30 * 24 * 60 * 60 * 1000);
      case "year":
        return now - (365 * 24 * 60 * 60 * 1000);
      default:
        return 0;
    }
  }

  /**
   * Sort content based on specified criteria
   */
  private sortContent(content: ContentItem[], sortBy: string, sortOrder: string, query?: string): ContentItem[] {
    const sorted = [...content].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "relevance":
          if (query?.trim()) {
            // Calculate relevance score based on query matches in title vs description
            const scoreA = this.calculateRelevanceScore(a, query);
            const scoreB = this.calculateRelevanceScore(b, query);
            comparison = scoreB - scoreA;
          } else {
            // Default to date if no query
            comparison = b.timestamp - a.timestamp;
          }
          break;

        case "date":
          comparison = b.timestamp - a.timestamp;
          break;

        case "downloads":
          const downloadsA = a.category === "notes" ? ((a as Note).downloads || 0) : ((a as Video).views || 0);
          const downloadsB = b.category === "notes" ? ((b as Note).downloads || 0) : ((b as Video).views || 0);
          comparison = downloadsB - downloadsA;
          break;

        case "title":
          comparison = a.title.localeCompare(b.title);
          break;

        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(item: ContentItem, query: string): number {
    const title = item.title.toLowerCase();
    const description = (item.description || "").toLowerCase();
    const searchQuery = query.toLowerCase();

    let score = 0;

    // Title matches are weighted higher
    if (title.includes(searchQuery)) score += 10;
    
    // Description matches
    if (description.includes(searchQuery)) score += 5;

    // Exact matches get bonus points
    if (title === searchQuery) score += 20;

    // Word matches
    const queryWords = searchQuery.split(' ').filter(w => w.length > 0);
    queryWords.forEach(word => {
      if (title.includes(word)) score += 3;
      if (description.includes(word)) score += 1;
    });

    // Popular content gets slight boost
    const popularity = item.category === "notes" 
      ? ((item as Note).downloads || 0) 
      : ((item as Video).views || 0);
    score += Math.min(popularity * 0.1, 5);

    return score;
  }
}

export const firebaseService = new FirebaseService();
