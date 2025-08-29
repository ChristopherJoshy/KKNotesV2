import { ref, set, push, remove, onValue, off, get } from "firebase/database";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { database, storage } from "./firebase";
import { Note, Video, Subject, User, InsertNote, InsertVideo, ContentItem } from "@shared/schema";

export class FirebaseService {
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

  async addAdmin(params: { email: string; nickname?: string; role?: 'admin' | 'superadmin'; addedBy?: string }): Promise<void> {
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
  }

  async removeAdminByKey(adminKey: string): Promise<void> {
    // Load entry to check protection
    const entrySnap = await get(ref(database, `admins/${adminKey}`));
    const entryVal = entrySnap.val();
    let email: string | null = null;
    if (!entryVal) throw new Error('Admin not found');
    if (typeof entryVal === 'string') {
      email = entryVal;
    } else if (typeof entryVal === 'object') {
      email = entryVal.email || entryVal.userEmail || (adminKey.includes('@') ? adminKey : null);
    }
    if (!email) throw new Error('Cannot resolve admin email');
    if (await this.isProtectedAdmin(email)) {
      throw new Error('Cannot remove the head admin');
    }
    await remove(ref(database, `admins/${adminKey}`));
  }
  // Notes operations
  async createNote(note: InsertNote, file?: File): Promise<string> {
    try {
      // If a file is provided, upload to Storage; otherwise, use provided URL
      let finalUrl = note.url;
      if (file) {
        const fileRef = storageRef(storage, `notes/${note.semester}/${note.subjectId}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        finalUrl = await getDownloadURL(snapshot.ref);
      }

      // Create note record in Realtime Database under nested path with finalUrl
      const noteRef = push(ref(database, `notes/${note.semester}/${note.subjectId}`));
      const noteData: Note = {
        ...note,
        id: noteRef.key!,
        url: finalUrl || "",
        timestamp: Date.now(),
        downloads: 0,
        category: "notes",
      };

      await set(noteRef, noteData);
      return noteRef.key!;
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  }

  async deleteNote(noteId: string, semester: string, subjectId: string): Promise<void> {
    try {
      // Get note data first from nested path
      const noteRef = ref(database, `notes/${semester}/${subjectId}/${noteId}`);
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

  async getNotesBySubject(semester: string, subjectId: string): Promise<Note[]> {
    try {
      const notesRef = ref(database, `notes/${semester}/${subjectId}`);
      const snapshot = await get(notesRef);
      const byKey = snapshot.val() || {};
      const notes: Note[] = Object.entries(byKey).map(([id, val]: [string, any]) => ({
        id,
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

  async getVideosBySubject(semester: string, subjectId: string): Promise<Video[]> {
    try {
      const videosRef = ref(database, `videos/${semester}/${subjectId}`);
      const snapshot = await get(videosRef);
      const byKey = snapshot.val() || {};
      const videos: Video[] = Object.entries(byKey).map(([id, val]: [string, any]) => ({
        id,
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

  async createVideo(video: InsertVideo): Promise<string> {
    try {
      // Create video record in Realtime Database under nested path
      const videoRef = push(ref(database, `videos/${video.semester}/${video.subjectId}`));
      const videoData: Video = {
        ...video,
        id: videoRef.key!,
        timestamp: Date.now(),
        views: 0,
        category: "videos",
      };

      await set(videoRef, videoData);
      return videoRef.key!;
    } catch (error) {
      console.error('Error creating video:', error);
      throw error;
    }
  }

  async deleteVideo(videoId: string, semester: string, subjectId: string): Promise<void> {
    try {
      const videoRef = ref(database, `videos/${semester}/${subjectId}/${videoId}`);
      await remove(videoRef);
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  }

  /**
   * Fetch all notes and videos for a semester with only two reads, and flatten to ContentItem[]
   */
  async getAllContentForSemester(semester: string): Promise<ContentItem[]> {
    try {
      const [notesSnap, videosSnap] = await Promise.all([
        get(ref(database, `notes/${semester}`)),
        get(ref(database, `videos/${semester}`)),
      ]);

      const results: ContentItem[] = [];

      const notesBySubject = (notesSnap.val() || {}) as Record<string, any>;
      Object.entries(notesBySubject).forEach(([subjectId, byId]) => {
        if (!byId || typeof byId !== 'object') return;
        Object.entries(byId as Record<string, any>).forEach(([id, val]) => {
          if (!val) return;
          results.push({
            id,
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
    updates: Partial<{ semester: string; subjectId: string; category: 'notes' | 'videos'; title: string; description: string; url: string }>
  ): Promise<void> {
    const fromCategory = item.category;
    const toCategory = updates.category || fromCategory;
    const fromSem = item.semester;
    const toSem = updates.semester || fromSem;
    const fromSubject = item.subjectId;
    const toSubject = updates.subjectId || fromSubject;

    // read current snapshot to merge counters and existing fields
    const fromPath = `${fromCategory}/${fromSem}/${fromSubject}/${item.id}`;
    const snap = await get(ref(database, fromPath));
    const current = (snap.val() || {}) as any;

    // Build new record based on target category
    if (toCategory === 'notes') {
      const newNote: Note = {
        id: item.id,
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
      const toPath = `notes/${toSem}/${toSubject}/${item.id}`;
      await set(ref(database, toPath), newNote);
    } else {
      const newVideo: Video = {
        id: item.id,
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
      const toPath = `videos/${toSem}/${toSubject}/${item.id}`;
      await set(ref(database, toPath), newVideo);
    }

    // Remove from old location if path or category changed
    if (fromCategory !== toCategory || fromSem !== toSem || fromSubject !== toSubject) {
      await remove(ref(database, `${fromCategory}/${fromSem}/${fromSubject}/${item.id}`));
    }
  }

  async incrementDownload(item: { id: string; semester: string; subjectId: string }): Promise<void> {
    try {
    const path = `notes/${item.semester}/${item.subjectId}/${item.id}`;
    const noteRef = ref(database, path);
    const snapshot = await get(noteRef);
    const noteData = snapshot.val() as any;
    const current = noteData && typeof noteData.downloads === 'number' ? noteData.downloads : 0;
    await set(ref(database, `${path}/downloads`), current + 1);
    } catch (error) {
      console.error('Error incrementing download:', error);
    }
  }

  async incrementView(item: { id: string; semester: string; subjectId: string }): Promise<void> {
    try {
    const path = `videos/${item.semester}/${item.subjectId}/${item.id}`;
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
  async getSubjects(semester: string): Promise<Record<string, Subject>> {
    try {
      const subjectsRef = ref(database, `subjects/${semester}`);
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

  async updateSubject(semester: string, subjectId: string, subject: Partial<Subject>): Promise<void> {
    try {
      const subjectRef = ref(database, `subjects/${semester}/${subjectId}`);
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
  onContentChange(semester: string, subjectId: string, category: "all" | "notes" | "videos", callback: (content: ContentItem[]) => void): () => void {
    // In the provided DB, notes and videos are under /notes/<sem>/<subjectKey> and /videos/<sem>/<subjectKey>
    const paths: Array<{ type: "notes" | "videos"; refPath: string }> = [];
  if (category === "all" || category === "notes") paths.push({ type: "notes", refPath: `notes/${semester}/${subjectId}` });
  if (category === "all" || category === "videos") paths.push({ type: "videos", refPath: `videos/${semester}/${subjectId}` });

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

  onNotesChange(semester: string, subjectId: string, callback: (notes: Note[]) => void): () => void {
    const notesRef = ref(database, `notes/${semester}/${subjectId}`);

    const listener = async (snapshot: any) => {
      const byKey = snapshot.val() || {};
      const notes: Note[] = Object.entries(byKey).map(([id, val]: [string, any]) => ({
        id,
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
            this.getAllContentForSemester(sem),
            this.getSubjects(sem),
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
  async getAllSubjects(): Promise<Record<string, { name: string; semester: string }>> {
    try {
      const allSubjects: Record<string, { name: string; semester: string }> = {};
      const semesters = ['s1','s2','s3','s4','s5','s6','s7','s8'];

      for (const semester of semesters) {
        const semesterSubjects = await this.getSubjects(semester);
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
