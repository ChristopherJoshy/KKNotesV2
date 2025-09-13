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

export type Subject = z.infer<typeof subjectSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Video = z.infer<typeof videoSchema>;
export type User = z.infer<typeof userSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ContentItem = Note | Video;

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
