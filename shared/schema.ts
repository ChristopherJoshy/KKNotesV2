import { z } from "zod";

// Firebase schema types
export const subjectSchema = z.object({
  name: z.string(),
  credit: z.number(),
  grade: z.string(),
  notes: z.array(z.string()).default([]),
  videos: z.array(z.string()).default([]),
});

export const noteSchema = z.object({
  id: z.string(),
  scheme: z.string().default("2019"),
  semester: z.string(),
  subjectId: z.string(),
  title: z.string(),
  url: z.string(),
  uploadedBy: z.string(),
  timestamp: z.number(),
  downloads: z.number().default(0),
  description: z.string().optional(),
  category: z.enum(["notes", "videos"]).default("notes"),
});

export const videoSchema = z.object({
  id: z.string(),
  scheme: z.string().default("2019"),
  semester: z.string(),
  subjectId: z.string(),
  title: z.string(),
  url: z.string(),
  uploadedBy: z.string(),
  timestamp: z.number(),
  views: z.number().default(0),
  description: z.string().optional(),
  category: z.enum(["notes", "videos"]).default("videos"),
});

// Pending submission schema for user-submitted content awaiting approval
export const pendingSubmissionSchema = z.object({
  id: z.string(),
  scheme: z.string().default("2019"),
  semester: z.string(),
  subjectId: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string().optional(),
  contentType: z.enum(["notes", "videos"]),
  submittedBy: z.string(), // user uid or email
  submitterName: z.string().optional(),
  submitterEmail: z.string().optional(),
  submittedAt: z.number(),
  expiresAt: z.number(), // auto-delete after 30 days
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

// Notification schema for user notifications
export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(), // recipient user id
  type: z.enum([
    "submission_pending",      // When user submits content
    "submission_approved",     // When admin approves content
    "submission_rejected",     // When admin rejects content
    "content_rated",           // When someone rates your content
    "content_reported",        // When your content is reported (for admins)
    "pending_approval",        // Notify admins of new pending submissions
    "admin_added",             // When a new admin is added
    "admin_removed",           // When an admin is removed
    "report_reviewed",         // When another admin reviews a report
    "content_approved",        // When an admin approves content (notify other admins)
    "admin_content_added",     // When an admin directly adds content
    "admin_content_deleted",   // When an admin deletes content
    "admin_scheme_created",    // When an admin creates a new scheme
    "admin_subject_added",     // When an admin adds a subject
    "admin_subject_deleted",   // When an admin deletes a subject
    "content_deleted",         // When user's content is deleted by admin
  ]),
  title: z.string(),
  message: z.string(),
  contentId: z.string().optional(), // Related content ID
  contentType: z.enum(["notes", "videos"]).optional(),
  fromUser: z.string().optional(), // Who triggered the notification
  fromUserName: z.string().optional(),
  read: z.boolean().default(false),
  createdAt: z.number(),
});

// Rating schema for content ratings
export const ratingSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  contentType: z.enum(["notes", "videos"]),
  scheme: z.string().default("2019"),
  semester: z.string(),
  subjectId: z.string(),
  userId: z.string(),
  userName: z.string().optional(),
  rating: z.number().min(1).max(5), // 1-5 stars
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});

// Report schema for content reports
export const reportSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  contentType: z.enum(["notes", "videos"]),
  scheme: z.string().default("2019"),
  semester: z.string(),
  subjectId: z.string(),
  contentTitle: z.string(),
  contentUploadedBy: z.string().optional(),
  reportedBy: z.string(),
  reporterName: z.string().optional(),
  reporterEmail: z.string().optional(),
  reason: z.enum([
    "inappropriate",
    "spam",
    "copyright",
    "incorrect_info",
    "broken_link",
    "duplicate",
    "other"
  ]),
  description: z.string().optional(),
  status: z.enum(["pending", "reviewed", "resolved", "dismissed"]).default("pending"),
  adminNotes: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.number().optional(),
  createdAt: z.number(),
});

export const userSchema = z.object({
  uid: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["student", "admin", "superadmin"]),
  photoURL: z.string().optional(),
});

export const insertNoteSchema = noteSchema.omit({ id: true, timestamp: true, downloads: true });
export const insertVideoSchema = videoSchema.omit({ id: true, timestamp: true, views: true });
export const insertUserSchema = userSchema.omit({ uid: true });
export const insertPendingSubmissionSchema = pendingSubmissionSchema.omit({ id: true, submittedAt: true, expiresAt: true, status: true });
export const insertNotificationSchema = notificationSchema.omit({ id: true, createdAt: true, read: true });
export const insertRatingSchema = ratingSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const insertReportSchema = reportSchema.omit({ id: true, createdAt: true, status: true, adminNotes: true, reviewedBy: true, reviewedAt: true });

export type Subject = z.infer<typeof subjectSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Video = z.infer<typeof videoSchema>;
export type User = z.infer<typeof userSchema>;
export type PendingSubmission = z.infer<typeof pendingSubmissionSchema>;
export type AppNotification = z.infer<typeof notificationSchema>;
export type Rating = z.infer<typeof ratingSchema>;
export type Report = z.infer<typeof reportSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPendingSubmission = z.infer<typeof insertPendingSubmissionSchema>;
export type InsertAppNotification = z.infer<typeof insertNotificationSchema>;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type InsertReport = z.infer<typeof insertReportSchema>;

export type ContentItem = Note | Video;

// Scheme schema for curriculum versions (e.g., 2019, 2024, etc.)
export const schemeSchema = z.object({
  id: z.string(),
  name: z.string(), // e.g., "2019 Scheme", "2024 Scheme"
  year: z.number(),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.number(),
  createdBy: z.string().optional(),
});

export type Scheme = z.infer<typeof schemeSchema>;
export const insertSchemeSchema = schemeSchema.omit({ id: true, createdAt: true });
export type InsertScheme = z.infer<typeof insertSchemeSchema>;

// Available schemes list
export const DEFAULT_SCHEMES = [
  { id: "2019", name: "2019 Scheme", year: 2019, isDefault: true, description: "KTU 2019 Curriculum" }
];

// Report reason labels for UI display
export const REPORT_REASON_LABELS: Record<Report['reason'], string> = {
  inappropriate: "Inappropriate Content",
  spam: "Spam or Misleading",
  copyright: "Copyright Violation",
  incorrect_info: "Incorrect Information",
  broken_link: "Broken or Invalid Link",
  duplicate: "Duplicate Content",
  other: "Other Issue",
};

// Semester data structure
export const SEMESTERS = {
  semester1: {
    1: { name: "LINEAR ALGEBRA AND CALCULUS", credit: 4, grade: "", notes: [], videos: [] },
    2: { name: "ENGINEERING PHYSICS A / ENGINEERING CHEMISTRY", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "ENGINEERING MECHANICS / ENGINEERING GRAPHICS", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "BASICS OF CIVIL & MECHANICAL ENGINEERING / BASICS OF ELECTRICAL & ELECTRONICS ENGINEERING", credit: 3, grade: "", notes: [], videos: [] },
    5: { name: "ENGINEERING PHYSICS LAB / ENGINEERING CHEMISTRY LAB", credit: 1, grade: "", notes: [], videos: [] },
    6: { name: "CIVIL & MECHANICAL WORKSHOP / ELECTRICAL & ELECTRONICS WORKSHOP", credit: 1, grade: "", notes: [], videos: [] }
  },
  semester2: {
    1: { name: "VECTOR CALCULUS , DIFFERENTIAL EQUATIONS AND TRANSFORMS", credit: 4, grade: "", notes: [], videos: [] },
    2: { name: "ENGINEERING PHYSICS A / ENGINEERING CHEMISTRY", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "ENGINEERING MECHANICS / ENGINEERING GRAPHICS", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "BASICS OF CIVIL & MECHANICAL ENGINEERING / BASICS OF ELECTRICAL & ELECTRONICS ENGINEERING", credit: 3, grade: "", notes: [], videos: [] },
    5: { name: "ENGINEERING PHYSICS LAB / ENGINEERING CHEMISTRY LAB", credit: 1, grade: "", notes: [], videos: [] },
    6: { name: "CIVIL & MECHANICAL WORKSHOP / ELECTRICAL & ELECTRONICS WORKSHOP", credit: 1, grade: "", notes: [], videos: [] },
    7: { name: "PROGRAMMING IN C", credit: 3, grade: "", notes: [], videos: [] }
  },
  semester3: {
    1: { name: "DISCRETE MATHEMATICAL STRUCTURES", credit: 4, grade: "", notes: [], videos: [] },
    2: { name: "DATA STRUCTURES", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "LOGIC SYSTEM DESIGN", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "OBJECT ORIENTED PROGRAMMING USING JAVA", credit: 3, grade: "", notes: [], videos: [] },
    5: { name: "DESIGN & ENGINEERING / PROFESSIONAL ETHICS", credit: 2, grade: "", notes: [], videos: [] },
    6: { name: "SUSTAINABLE ENGINEERING", credit: 2, grade: "", notes: [], videos: [] },
    7: { name: "DATA STRUCTURES LAB", credit: 1, grade: "", notes: [], videos: [] },
    8: { name: "OBJECT ORIENTED PROGRAMMING LAB (IN JAVA)", credit: 1, grade: "", notes: [], videos: [] }
  },
  semester4: {
    1: { name: "ADVANCED MATHEMATICS", credit: 4, grade: "", notes: [], videos: [] },
    2: { name: "COMPUTER ORGANIZATION", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "DATABASE MANAGEMENT SYSTEMS", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "OPERATING SYSTEMS", credit: 3, grade: "", notes: [], videos: [] },
    5: { name: "SOFTWARE ENGINEERING", credit: 3, grade: "", notes: [], videos: [] },
    6: { name: "COMPUTER NETWORKS", credit: 3, grade: "", notes: [], videos: [] }
  },
  semester5: {
    1: { name: "COMPILER DESIGN", credit: 4, grade: "", notes: [], videos: [] },
    2: { name: "ARTIFICIAL INTELLIGENCE", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "WEB TECHNOLOGIES", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "MACHINE LEARNING", credit: 3, grade: "", notes: [], videos: [] },
    5: { name: "MOBILE APPLICATION DEVELOPMENT", credit: 3, grade: "", notes: [], videos: [] }
  },
  semester6: {
    1: { name: "DISTRIBUTED SYSTEMS", credit: 4, grade: "", notes: [], videos: [] },
    2: { name: "CLOUD COMPUTING", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "CYBERSECURITY", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "BIG DATA ANALYTICS", credit: 3, grade: "", notes: [], videos: [] },
    5: { name: "INTERNET OF THINGS", credit: 3, grade: "", notes: [], videos: [] }
  },
  semester7: {
    1: { name: "PROJECT WORK I", credit: 6, grade: "", notes: [], videos: [] },
    2: { name: "ADVANCED ALGORITHMS", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "BLOCKCHAIN TECHNOLOGY", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "ELECTIVE I", credit: 3, grade: "", notes: [], videos: [] }
  },
  semester8: {
    1: { name: "PROJECT WORK II", credit: 8, grade: "", notes: [], videos: [] },
    2: { name: "INDUSTRIAL TRAINING", credit: 4, grade: "", notes: [], videos: [] },
    3: { name: "ELECTIVE II", credit: 3, grade: "", notes: [], videos: [] },
    4: { name: "PROFESSIONAL SKILLS", credit: 1, grade: "", notes: [], videos: [] }
  }
};
