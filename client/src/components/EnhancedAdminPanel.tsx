import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { firebaseService } from "@/lib/firebaseAdmin";
import { InsertNote, InsertVideo, Note, Video, User, ContentItem, PendingSubmission, Report, REPORT_REASON_LABELS, Scheme } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface EnhancedAdminPanelProps {
  onClose: () => void;
}

const SEMESTER_OPTIONS = [
  { value: "s1", label: "Semester 1" },
  { value: "s2", label: "Semester 2" },
  { value: "s3", label: "Semester 3" },
  { value: "s4", label: "Semester 4" },
  { value: "s5", label: "Semester 5" },
  { value: "s6", label: "Semester 6" },
  { value: "s7", label: "Semester 7" },
  { value: "s8", label: "Semester 8" },
];

export function EnhancedAdminPanel({ onClose }: EnhancedAdminPanelProps) {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || "").toLowerCase() === "superadmin";

  // Scheme management state
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<string>("2019");
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [isCreateSchemeOpen, setIsCreateSchemeOpen] = useState(false);
  const [newSchemeYear, setNewSchemeYear] = useState("");
  const [newSchemeDescription, setNewSchemeDescription] = useState("");
  const [creatingScheme, setCreatingScheme] = useState(false);
  
  // Subject management state
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newSubjectSemester, setNewSubjectSemester] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);
  const [deletingSubjectId, setDeletingSubjectId] = useState<string | null>(null);
  const [schemeSubjectsSemester, setSchemeSubjectsSemester] = useState<string>("s1");
  const [schemeSubjects, setSchemeSubjects] = useState<Record<string, any>>({});
  const [loadingSchemeSubjects, setLoadingSchemeSubjects] = useState(false);
  
  // Subject editing state
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);

  // Content upload form
  const [uploadForm, setUploadForm] = useState({
    scheme: "2019",
    semester: "",
    subjectId: "",
    title: "",
    description: "",
    category: "notes" as "notes" | "videos",
    url: ""
  });

  const [subjects, setSubjects] = useState<Record<string, any>>({});
  const [subjectsBySem, setSubjectsBySem] = useState<Record<string, Record<string, any>>>({});
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [admins, setAdmins] = useState<Array<{ key: string; email: string; role: string; isPermanent?: boolean }>>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [removingAdminKey, setRemovingAdminKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ scheme: string; semester: string; subjectId: string; category: 'notes' | 'videos'; title: string; description: string; url?: string }>({
    scheme: '2019', semester: '', subjectId: '', category: 'notes', title: '', description: '', url: ''
  });
  const [manageSemester, setManageSemester] = useState<string>('all');
  const [manageSubjectId, setManageSubjectId] = useState<string>('all');
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [processingSubmission, setProcessingSubmission] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [processingReport, setProcessingReport] = useState<string | null>(null);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed'>('pending');

  useEffect(() => {
    loadSchemes();
    loadAllContent();
    loadPendingSubmissions();
    loadReports();
    if (isSuperAdmin) {
      loadAllUsers();
  loadAdmins();
    }
  }, [isSuperAdmin]);

  // Load schemes
  const loadSchemes = async () => {
    setLoadingSchemes(true);
    try {
      const schemeList = await firebaseService.getSchemes();
      setSchemes(schemeList);
      if (schemeList.length > 0 && !selectedScheme) {
        const defaultScheme = schemeList.find(s => s.isDefault) || schemeList[0];
        setSelectedScheme(defaultScheme.id);
        setUploadForm(prev => ({ ...prev, scheme: defaultScheme.id }));
      }
    } catch (error) {
      console.error('Error loading schemes:', error);
    } finally {
      setLoadingSchemes(false);
    }
  };

  // Create new scheme
  const handleCreateScheme = async () => {
    const year = parseInt(newSchemeYear);
    if (!year || year < 2000 || year > 2100) {
      toast({ title: "Invalid Year", description: "Please enter a valid year between 2000 and 2100.", variant: "destructive" });
      return;
    }
    setCreatingScheme(true);
    try {
      await firebaseService.createScheme({
        name: `${year} Scheme`,
        year,
        description: newSchemeDescription || `KTU ${year} Curriculum`,
        isDefault: false,
      });
      
      // Notify ALL admins
      await firebaseService.notifyAdminsOfActivity({
        type: 'admin_scheme_created',
        title: 'New Scheme Created',
        message: `${user?.name || user?.email || 'Admin'} created ${year} Scheme`,
        performedBy: user?.uid,
        performedByName: user?.name || user?.email,
      });
      
      toast({ title: "Scheme Created", description: `${year} Scheme has been created successfully.` });
      setNewSchemeYear("");
      setNewSchemeDescription("");
      setIsCreateSchemeOpen(false);
      await loadSchemes();
    } catch (error: any) {
      toast({ title: "Creation Failed", description: error?.message || "Failed to create scheme.", variant: "destructive" });
    } finally {
      setCreatingScheme(false);
    }
  };

  // Load subjects for scheme management
  const loadSchemeSubjects = async (semester: string, scheme: string) => {
    setLoadingSchemeSubjects(true);
    try {
      const subjects = await firebaseService.getSubjects(semester, scheme);
      setSchemeSubjects(subjects);
    } catch (error) {
      console.error('Error loading scheme subjects:', error);
    } finally {
      setLoadingSchemeSubjects(false);
    }
  };

  // Handle scheme change in subject management
  const handleSchemeSubjectsChange = async (scheme: string) => {
    setSelectedScheme(scheme);
    await loadSchemeSubjects(schemeSubjectsSemester, scheme);
  };

  // Handle semester change in subject management
  const handleSchemeSubjectsSemesterChange = async (semester: string) => {
    setSchemeSubjectsSemester(semester);
    await loadSchemeSubjects(semester, selectedScheme);
  };

  // Add new subject
  const handleAddSubject = async () => {
    if (!newSubjectName.trim() || !newSubjectId.trim() || !newSubjectSemester) {
      toast({ title: "Missing Information", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    setAddingSubject(true);
    try {
      await firebaseService.createSubject(newSubjectSemester, {
        id: newSubjectId.trim(),
        name: newSubjectName.trim(),
      }, selectedScheme);
      
      // Notify ALL admins
      await firebaseService.notifyAdminsOfActivity({
        type: 'admin_subject_added',
        title: 'New Subject Added',
        message: `${user?.name || user?.email || 'Admin'} added "${newSubjectName}" to ${selectedScheme} Scheme (${newSubjectSemester.toUpperCase()})`,
        performedBy: user?.uid,
        performedByName: user?.name || user?.email,
      });
      
      toast({ title: "Subject Added", description: `${newSubjectName} has been added to ${selectedScheme} scheme.` });
      setNewSubjectName("");
      setNewSubjectId("");
      setNewSubjectSemester("");
      setIsAddSubjectOpen(false);
      await loadSchemeSubjects(schemeSubjectsSemester, selectedScheme);
    } catch (error: any) {
      toast({ title: "Failed to Add Subject", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setAddingSubject(false);
    }
  };

  // Delete subject
  const handleDeleteSubject = async (subjectId: string) => {
    const subjectName = schemeSubjects[subjectId]?.name || subjectId;
    setDeletingSubjectId(subjectId);
    try {
      await firebaseService.deleteSubject(schemeSubjectsSemester, subjectId, selectedScheme);
      
      // Notify ALL admins
      await firebaseService.notifyAdminsOfActivity({
        type: 'admin_subject_deleted',
        title: 'Subject Deleted',
        message: `${user?.name || user?.email || 'Admin'} deleted "${subjectName}" from ${selectedScheme} Scheme`,
        performedBy: user?.uid,
        performedByName: user?.name || user?.email,
      });
      
      toast({ title: "Subject Deleted", description: "Subject and all its content have been removed." });
      await loadSchemeSubjects(schemeSubjectsSemester, selectedScheme);
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setDeletingSubjectId(null);
    }
  };

  // Edit subject name
  const handleEditSubject = (subjectId: string, currentName: string) => {
    setEditingSubjectId(subjectId);
    setEditSubjectName(currentName);
  };

  const handleSaveSubjectEdit = async () => {
    if (!editingSubjectId || !editSubjectName.trim()) return;
    
    setSavingSubject(true);
    try {
      await firebaseService.updateSubjectDetails(schemeSubjectsSemester, editingSubjectId, { name: editSubjectName.trim() }, selectedScheme);
      toast({ title: "Subject Updated", description: "Subject name has been updated." });
      setEditingSubjectId(null);
      setEditSubjectName("");
      await loadSchemeSubjects(schemeSubjectsSemester, selectedScheme);
    } catch (error: any) {
      toast({ title: "Update Failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setSavingSubject(false);
    }
  };

  const handleCancelSubjectEdit = () => {
    setEditingSubjectId(null);
    setEditSubjectName("");
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const allReports = await firebaseService.getReports();
      setReports(allReports);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'reviewed' | 'resolved' | 'dismissed') => {
    setProcessingReport(reportId);
    try {
      await firebaseService.updateReportStatus(reportId, status, undefined, user?.uid, user?.name || user?.email);
      toast({
        title: "Report Updated",
        description: `Report status changed to ${status}.`,
      });
      await loadReports();
    } catch (error) {
      console.error('Error updating report:', error);
      toast({
        title: "Update Failed",
        description: "Could not update the report status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingReport(null);
    }
  };

  const handleDeleteReportedContent = async (report: Report) => {
    setProcessingReport(report.id);
    try {
      // Delete the content
      if (report.contentType === 'notes') {
        await firebaseService.deleteNote(report.contentId, report.semester, report.subjectId);
      } else {
        await firebaseService.deleteVideo(report.contentId, report.semester, report.subjectId);
      }
      
      // Update report status to resolved
      await firebaseService.updateReportStatus(report.id, 'resolved', 'Content was deleted.', user?.uid, user?.name || user?.email);
      
      toast({
        title: "Content Deleted",
        description: "The reported content has been removed.",
      });
      
      await loadReports();
      await loadAllContent();
    } catch (error) {
      console.error('Error deleting reported content:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete the content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingReport(null);
    }
  };

  const loadPendingSubmissions = async () => {
    setLoadingPending(true);
    try {
      const submissions = await firebaseService.getPendingSubmissions();
      setPendingSubmissions(submissions);
      
      // Load subjects for all semesters that have pending submissions
      const uniqueSemesters = Array.from(new Set(submissions.map(s => s.semester)));
      await Promise.all(uniqueSemesters.map(sem => ensureSubjects(sem)));
    } catch (error) {
      console.error('Error loading pending submissions:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    setProcessingSubmission(submissionId);
    try {
      // The firebaseService now handles all notifications internally
      await firebaseService.approvePendingSubmission(submissionId, user?.uid, user?.name || user?.email);
      
      toast({
        title: "Approved",
        description: "Submission has been approved and published.",
      });
      await loadPendingSubmissions();
      await loadAllContent();
    } catch (error) {
      console.error('Error approving submission:', error);
      toast({
        title: "Approval Failed",
        description: "Could not approve the submission. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingSubmission(null);
    }
  };

  const handleRejectSubmission = async (submissionId: string) => {
    setProcessingSubmission(submissionId);
    try {
      // The firebaseService now handles all notifications internally
      await firebaseService.rejectPendingSubmission(submissionId, user?.uid, user?.name || user?.email);
      
      toast({
        title: "Rejected",
        description: "Submission has been rejected and removed.",
      });
      await loadPendingSubmissions();
    } catch (error) {
      console.error('Error rejecting submission:', error);
      toast({
        title: "Rejection Failed",
        description: "Could not reject the submission. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingSubmission(null);
    }
  };

  const loadAllContent = async () => {
    setLoadingContent(true);
    try {
      const semesters = ['s1','s2','s3','s4','s5','s6','s7','s8'];
  // Build list of semester-level fetches (2 reads per semester)
  const tasks: Array<Promise<ContentItem[]>> = semesters.map((sem) => firebaseService.getAllContentForSemester(sem));

      // Batch to avoid creating too many parallel requests at once
  const BATCH = 8;
      const results: ContentItem[] = [];
      for (let i = 0; i < tasks.length; i += BATCH) {
        const slice = tasks.slice(i, i + BATCH);
        const settled = await Promise.allSettled(slice);
        for (const r of settled) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            results.push(...r.value);
          }
        }
      }

      // Sort newest first
      results.sort((a, b) => b.timestamp - a.timestamp);
      setContent(results);
    } catch (error) {
      console.error('Error loading content:', error);
      setContent([]);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleDeleteItem = async (item: ContentItem) => {
    try {
      setDeletingId(item.id);
      if (item.category === 'notes') {
        await firebaseService.deleteNote(item.id, item.semester, item.subjectId);
      } else {
        await firebaseService.deleteVideo(item.id, item.semester, item.subjectId);
      }
      
      // Notify ALL admins about content deletion
      await firebaseService.notifyAdminsOfActivity({
        type: 'admin_content_deleted',
        title: 'Content Deleted',
        message: `${user?.name || user?.email || 'Admin'} deleted ${item.category === 'notes' ? 'notes' : 'video'}: "${item.title}"`,
        contentType: item.category as 'notes' | 'videos',
        performedBy: user?.uid,
        performedByName: user?.name || user?.email,
      });
      
      // Notify the content uploader if they exist and are different from admin
      if (item.uploadedBy && item.uploadedBy !== user?.uid) {
        await firebaseService.notifyUserOfContentAction(item.uploadedBy, {
          type: 'content_deleted',
          title: 'Your Content Was Removed',
          message: `Your ${item.category === 'notes' ? 'notes' : 'video'} "${item.title}" was removed by an admin.`,
          contentType: item.category as 'notes' | 'videos',
          fromUser: user?.uid,
          fromUserName: user?.name || user?.email,
        });
      }
      
      toast({ title: 'Deleted', description: `${item.title} removed.` });
      await loadAllContent();
    } catch (e) {
      console.error('Delete failed', e);
      toast({ title: 'Delete failed', description: 'Could not delete item.', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const loadAllUsers = async () => {
    try {
      const allUsers = await firebaseService.getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const a = await firebaseService.getAdmins();
      setAdmins(a);
    } catch (e) {
      console.error('Error loading admins:', e);
    }
  };

  const loadSubjects = async (semester: string, scheme?: string) => {
    try {
      const schemeToUse = scheme || uploadForm.scheme;
      const semesterSubjects = await firebaseService.getSubjects(semester, schemeToUse);
      setSubjects(semesterSubjects);
  setSubjectsBySem(prev => ({ ...prev, [`${schemeToUse}:${semester}`]: semesterSubjects }));
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast({
        title: "Error",
        description: "Failed to load subjects",
        variant: "destructive"
      });
    }
  };

  const handleSchemeChange = (scheme: string) => {
    setUploadForm(prev => ({ ...prev, scheme, semester: "", subjectId: "" }));
    setSubjects({});
  };

  const handleSemesterChange = (semester: string) => {
    setUploadForm(prev => ({ ...prev, semester, subjectId: "" }));
    loadSubjects(semester, uploadForm.scheme);
  };

  const ensureSubjects = async (semester: string, scheme?: string) => {
    const schemeToUse = scheme || uploadForm.scheme;
    const key = `${schemeToUse}:${semester}`;
    if (!subjectsBySem[key]) {
      const s = await firebaseService.getSubjects(semester, schemeToUse);
      setSubjectsBySem(prev => ({ ...prev, [key]: s }));
    }
  };

  const handleManageSemesterChange = async (semester: string) => {
    setManageSemester(semester);
    setManageSubjectId('all');
    if (semester !== 'all') await ensureSubjects(semester);
  };

  const filteredContent = content.filter((item) => {
    if (manageSemester !== 'all' && item.semester !== manageSemester) return false;
    if (manageSubjectId !== 'all' && item.subjectId !== manageSubjectId) return false;
    return true;
  });

  // No file upload; using URL for both notes and videos

  const handleUpload = async () => {
    if (!uploadForm.scheme || !uploadForm.semester || !uploadForm.subjectId || !uploadForm.title) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields including scheme",
        variant: "destructive"
      });
      return;
    }

  if (!uploadForm.url) {
      toast({
        title: "Missing URL",
    description: "Please provide a URL",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      if (uploadForm.category === "notes") {
        const noteData: InsertNote & { scheme: string } = {
          scheme: uploadForm.scheme,
          semester: uploadForm.semester,
          subjectId: uploadForm.subjectId,
          title: uploadForm.title,
          description: uploadForm.description,
          url: uploadForm.url,
          uploadedBy: user?.uid || "admin",
          category: "notes"
        };

        await firebaseService.createNote(noteData as any);
      } else {
        const videoData: InsertVideo & { scheme: string } = {
          scheme: uploadForm.scheme,
          semester: uploadForm.semester,
          subjectId: uploadForm.subjectId,
          title: uploadForm.title,
          description: uploadForm.description,
          url: uploadForm.url,
          uploadedBy: user?.uid || "admin",
          category: "videos"
        };

        await firebaseService.createVideo(videoData as any);
      }
      
      // Get subject name for notification
      const subjectName = subjects[uploadForm.subjectId]?.name || uploadForm.subjectId;
      
      // Notify ALL admins about the new content upload
      await firebaseService.notifyAdminsOfActivity({
        type: 'admin_content_added',
        title: 'New Content Added',
        message: `${user?.name || user?.email || 'Admin'} added ${uploadForm.category === "notes" ? "notes" : "video"}: "${uploadForm.title}" for ${subjectName}`,
        contentType: uploadForm.category === "notes" ? "notes" : "videos",
        performedBy: user?.uid,
        performedByName: user?.name || user?.email,
      });
      
      toast({
        title: "Success",
        description: `${uploadForm.category === "notes" ? "Note" : "Video"} uploaded successfully`
      });

      // Reload content to update statistics
      await loadAllContent();

      // Reset form
      setUploadForm({
        scheme: uploadForm.scheme,
        semester: "",
        subjectId: "",
        title: "",
        description: "",
        category: "notes",
        url: ""
      });
    } catch (error) {
      console.error('Error uploading:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePromoteUser = async () => {
    if (!selectedUser) {
      toast({
        title: "No User Selected",
        description: "Please select a user to promote",
        variant: "destructive"
      });
      return;
    }

    try {
      await firebaseService.promoteToAdmin(selectedUser);
      toast({
        title: "User Promoted",
        description: "User has been promoted to admin successfully"
      });
      await loadAllUsers();
      setSelectedUser("");
    } catch (error) {
      console.error('Error promoting user:', error);
      toast({
        title: "Promotion Error",
        description: "Failed to promote user. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAddAdmin = async () => {
    const email = newAdminEmail.trim();
    if (!email) {
      toast({ title: 'Missing email', description: 'Enter an email to add.', variant: 'destructive' });
      return;
    }
    setAddingAdmin(true);
    try {
      await firebaseService.addAdmin({ 
        email, 
        addedBy: user?.uid || undefined,
        addedByName: user?.name || user?.email || undefined 
      });
      
      // Notify ALL admins
      await firebaseService.notifyAdminsOfActivity({
        type: 'admin_added',
        title: 'New Admin Added',
        message: `${user?.name || user?.email || 'Admin'} added ${email} as an admin`,
        performedBy: user?.uid,
        performedByName: user?.name || user?.email,
      });
      
      toast({ title: 'Admin added', description: email });
      setNewAdminEmail("");
      await loadAdmins();
    } catch (e: any) {
      toast({ title: 'Failed to add admin', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminKey: string) => {
    const adminToRemove = admins.find(a => a.key === adminKey);
    setRemovingAdminKey(adminKey);
    try {
      await firebaseService.removeAdminByKey(adminKey, user?.uid, user?.name || user?.email);
      
      // Notify ALL admins
      await firebaseService.notifyAdminsOfActivity({
        type: 'admin_removed',
        title: 'Admin Removed',
        message: `${user?.name || user?.email || 'Admin'} removed ${adminToRemove?.email || 'an admin'} from the admin list`,
        performedBy: user?.uid,
        performedByName: user?.name || user?.email,
      });
      
      toast({ title: 'Admin removed' });
      await loadAdmins();
    } catch (e: any) {
      toast({ title: 'Cannot remove admin', description: e?.message || 'Try again.', variant: 'destructive' });
    } finally {
      setRemovingAdminKey(null);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const totalDownloads = content.filter(item => item.category === "notes").reduce((sum, note) => sum + ((note as Note).downloads || 0), 0);
  const totalViews = content.filter(item => item.category === "videos").reduce((sum, video) => sum + ((video as Video).views || 0), 0);

  return (
    <div className="fade-in">
      <Card className="shadow-sm border-border">
        <CardHeader className="p-4 sm:p-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <i className="fas fa-cog text-primary"></i>
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold">Admin Panel</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">Manage content and users</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isSuperAdmin ? "default" : "secondary"} className="text-xs">
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </Badge>
              <Button data-testid="button-close-admin" onClick={onClose} variant="outline" size="sm">
                <i className="fas fa-arrow-left mr-1.5"></i>
                <span className="hidden sm:inline">Back</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="upload" className="w-full">
            <div className="border-b overflow-x-auto scrollbar-hide">
              <TabsList className="w-full sm:w-auto inline-flex h-11 sm:h-12 bg-transparent p-0 rounded-none">
                <TabsTrigger 
                  value="upload" 
                  className="flex-1 sm:flex-none px-3 sm:px-6 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <i className="fas fa-upload mr-1.5 sm:mr-2"></i>
                  <span className="hidden xs:inline">Upload</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="pending" 
                  className="flex-1 sm:flex-none px-3 sm:px-6 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent relative"
                >
                  <i className="fas fa-clock mr-1.5 sm:mr-2"></i>
                  <span className="hidden xs:inline">Pending</span>
                  {pendingSubmissions.length > 0 && (
                    <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 flex items-center justify-center text-[10px] absolute -top-1 -right-1 sm:static sm:ml-2">
                      {pendingSubmissions.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="reports" 
                  className="flex-1 sm:flex-none px-3 sm:px-6 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent relative"
                >
                  <i className="fas fa-flag mr-1.5 sm:mr-2"></i>
                  <span className="hidden xs:inline">Reports</span>
                  {reports.filter(r => r.status === 'pending').length > 0 && (
                    <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 flex items-center justify-center text-[10px] absolute -top-1 -right-1 sm:static sm:ml-2">
                      {reports.filter(r => r.status === 'pending').length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="manage" 
                  className="flex-1 sm:flex-none px-3 sm:px-6 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <i className="fas fa-edit mr-1.5 sm:mr-2"></i>
                  <span className="hidden xs:inline">Manage</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="schemes" 
                  className="flex-1 sm:flex-none px-3 sm:px-6 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <i className="fas fa-graduation-cap mr-1.5 sm:mr-2"></i>
                  <span className="hidden xs:inline">Schemes</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="statistics" 
                  className="flex-1 sm:flex-none px-3 sm:px-6 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <i className="fas fa-chart-bar mr-1.5 sm:mr-2"></i>
                  <span className="hidden xs:inline">Stats</span>
                </TabsTrigger>
                {isSuperAdmin && (
                  <TabsTrigger 
                    value="users" 
                    className="flex-1 sm:flex-none px-3 sm:px-6 text-xs sm:text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                  >
                    <i className="fas fa-users mr-1.5 sm:mr-2"></i>
                    <span className="hidden xs:inline">Users</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Upload Content Tab */}
            <TabsContent value="upload" className="p-4 sm:p-6 mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Upload Form */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <i className="fas fa-cloud-upload-alt text-primary"></i>
                      Upload Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-xs sm:text-sm">Content Type</Label>
                      <Select 
                        value={uploadForm.category} 
                        onValueChange={(value: "notes" | "videos") => 
                          setUploadForm(prev => ({ ...prev, category: value }))
                        }
                      >
                        <SelectTrigger data-testid="select-content-category" className="mt-1.5">
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="notes">Notes (Link)</SelectItem>
                          <SelectItem value="videos">Videos (URL)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs sm:text-sm">Scheme *</Label>
                      <Select value={uploadForm.scheme} onValueChange={handleSchemeChange}>
                        <SelectTrigger data-testid="select-upload-scheme" className="mt-1.5">
                          <SelectValue placeholder="Select scheme" />
                        </SelectTrigger>
                        <SelectContent>
                          {schemes.map(scheme => (
                            <SelectItem key={scheme.id} value={scheme.id}>
                              {scheme.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs sm:text-sm">Semester</Label>
                        <Select value={uploadForm.semester} onValueChange={handleSemesterChange} disabled={!uploadForm.scheme}>
                          <SelectTrigger data-testid="select-upload-semester" className="mt-1.5">
                            <SelectValue placeholder="Select semester" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEMESTER_OPTIONS.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-xs sm:text-sm">Subject</Label>
                        <Select 
                          value={uploadForm.subjectId} 
                          onValueChange={(value) => setUploadForm(prev => ({ ...prev, subjectId: value }))}
                          disabled={!uploadForm.semester}
                        >
                          <SelectTrigger data-testid="select-upload-subject" className="mt-1.5">
                            <SelectValue placeholder="Select subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(subjects).map(([id, subject]) => (
                              <SelectItem key={`${uploadForm.scheme}:${uploadForm.semester}:${id}`} value={id}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs sm:text-sm">Title</Label>
                      <Input
                        data-testid="input-content-title"
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder={`Enter ${uploadForm.category} title`}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label className="text-xs sm:text-sm">Description (Optional)</Label>
                      <Textarea
                        data-testid="textarea-content-description"
                        value={uploadForm.description}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the content"
                        rows={2}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label className="text-xs sm:text-sm">{uploadForm.category === 'notes' ? 'Note URL' : 'Video URL'}</Label>
                      <Input
                        data-testid="input-content-url"
                        value={uploadForm.url}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, url: e.target.value }))}
                        placeholder={uploadForm.category === 'notes' ? 'https://drive.google.com/...' : 'https://youtube.com/watch?v=...'}
                        className="mt-1.5"
                      />
                    </div>

                    <Button
                      data-testid="button-upload-content"
                      onClick={handleUpload}
                      disabled={uploading}
                      className="w-full mt-2"
                    >
                      {uploading ? (
                        <>
                          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-upload mr-2"></i>
                          Upload {uploadForm.category === "notes" ? "Note" : "Video"}
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card className="border-chart-2/20 bg-chart-2/5">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <i className="fas fa-chart-pie text-chart-2"></i>
                      Quick Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {loadingContent ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading stats...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="stat-card">
                          <div className="stat-value text-primary">
                            {content.filter(item => item.category === "notes").length}
                          </div>
                          <div className="stat-label">Total Notes</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-value text-red-600">
                            {content.filter(item => item.category === "videos").length}
                          </div>
                          <div className="stat-label">Total Videos</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-value text-blue-600">
                            {totalDownloads}
                          </div>
                          <div className="stat-label">Downloads</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-value text-green-600">
                            {totalViews}
                          </div>
                          <div className="stat-label">Views</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pending Submissions Tab */}
            <TabsContent value="pending" className="p-4 sm:p-6 mt-0">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <i className="fas fa-clock text-orange-500"></i>
                      Pending Submissions
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={loadPendingSubmissions}
                      disabled={loadingPending}
                    >
                      <i className={`fas fa-sync-alt mr-1.5 ${loadingPending ? 'animate-spin' : ''}`}></i>
                      Refresh
                    </Button>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Review and approve user-submitted content. Submissions expire after 30 days.
                  </p>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  {loadingPending && (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Loading submissions...
                    </div>
                  )}

                  {!loadingPending && pendingSubmissions.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-inbox text-muted-foreground text-2xl"></i>
                      </div>
                      <h4 className="font-medium text-foreground mb-1">No Pending Submissions</h4>
                      <p className="text-sm text-muted-foreground">All submissions have been reviewed.</p>
                    </div>
                  )}

                  {!loadingPending && pendingSubmissions.length > 0 && (
                    <ScrollArea className="h-[400px] sm:h-[500px]">
                      <div className="space-y-3 pr-4">
                        {pendingSubmissions.map((submission) => {
                          const daysRemaining = Math.max(0, Math.ceil((submission.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));
                          const subjectName = subjectsBySem[submission.semester]?.[submission.subjectId]?.name || submission.subjectId;
                          
                          return (
                            <div key={submission.id} className="p-4 border rounded-lg bg-card">
                              <div className="flex flex-col gap-3">
                                {/* Header with type and expiry */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant={submission.contentType === 'notes' ? 'default' : 'destructive'}>
                                    {submission.contentType === 'notes' ? 'NOTE' : 'VIDEO'}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Semester {submission.semester.replace('s', '')}
                                  </Badge>
                                  <Badge 
                                    variant={daysRemaining <= 7 ? 'destructive' : 'secondary'} 
                                    className="text-xs ml-auto"
                                  >
                                    {daysRemaining} days left
                                  </Badge>
                                </div>

                                {/* Title and details */}
                                <div>
                                  <h4 className="font-semibold text-base">{submission.title}</h4>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Subject: {subjectName}
                                  </p>
                                  {submission.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {submission.description}
                                    </p>
                                  )}
                                </div>

                                {/* URL Preview */}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                  <i className="fas fa-link"></i>
                                  <a 
                                    href={submission.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="truncate hover:text-primary"
                                  >
                                    {submission.url}
                                  </a>
                                </div>

                                {/* Submitter info */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>
                                    <i className="fas fa-user mr-1"></i>
                                    {submission.submitterName || 'Anonymous'}
                                  </span>
                                  {submission.submitterEmail && (
                                    <span>
                                      <i className="fas fa-envelope mr-1"></i>
                                      {submission.submitterEmail}
                                    </span>
                                  )}
                                  <span>
                                    <i className="fas fa-calendar mr-1"></i>
                                    {new Date(submission.submittedAt).toLocaleDateString()}
                                  </span>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2 pt-2 border-t">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                    onClick={() => handleApproveSubmission(submission.id)}
                                    disabled={processingSubmission === submission.id}
                                  >
                                    {processingSubmission === submission.id ? (
                                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <i className="fas fa-check mr-1.5"></i>
                                        Approve
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-destructive hover:text-destructive"
                                    onClick={() => handleRejectSubmission(submission.id)}
                                    disabled={processingSubmission === submission.id}
                                  >
                                    <i className="fas fa-times mr-1.5"></i>
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    asChild
                                  >
                                    <a href={submission.url} target="_blank" rel="noopener noreferrer">
                                      <i className="fas fa-external-link-alt"></i>
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Reports Tab */}
            <TabsContent value="reports" className="p-4 sm:p-6 mt-0">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <i className="fas fa-flag text-orange-500"></i>
                      Content Reports
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={reportFilter} onValueChange={(v: any) => setReportFilter(v)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Reports</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="dismissed">Dismissed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadReports}
                        disabled={loadingReports}
                        className="h-8"
                      >
                        <i className={`fas fa-sync-alt ${loadingReports ? 'animate-spin' : ''}`}></i>
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Review and manage content reported by users.
                  </p>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  {loadingReports && (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Loading reports...
                    </div>
                  )}

                  {!loadingReports && reports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-flag text-muted-foreground text-2xl"></i>
                      </div>
                      <h4 className="font-medium text-foreground mb-1">No Reports</h4>
                      <p className="text-sm text-muted-foreground">
                        {reportFilter === 'all' ? 'No content has been reported yet.' : `No ${reportFilter} reports.`}
                      </p>
                    </div>
                  )}

                  {!loadingReports && reports.filter(r => reportFilter === 'all' || r.status === reportFilter).length > 0 && (
                    <ScrollArea className="h-[400px] sm:h-[500px]">
                      <div className="space-y-3 pr-4">
                        {reports
                          .filter(r => reportFilter === 'all' || r.status === reportFilter)
                          .map((report) => (
                          <div key={report.id} className="p-4 border rounded-lg bg-card">
                            <div className="flex flex-col gap-3">
                              {/* Header */}
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={report.contentType === 'notes' ? 'default' : 'destructive'}>
                                  {report.contentType === 'notes' ? 'NOTE' : 'VIDEO'}
                                </Badge>
                                <Badge 
                                  variant={
                                    report.status === 'pending' ? 'destructive' : 
                                    report.status === 'reviewed' ? 'secondary' : 
                                    report.status === 'resolved' ? 'default' : 'outline'
                                  }
                                  className="text-xs"
                                >
                                  {report.status.toUpperCase()}
                                </Badge>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(report.createdAt).toLocaleDateString()}
                                </span>
                              </div>

                              {/* Content info */}
                              <div>
                                <h4 className="font-semibold text-base">{report.contentTitle}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  <span className="font-medium text-orange-600 dark:text-orange-400">
                                    Reason: {REPORT_REASON_LABELS[report.reason]}
                                  </span>
                                </p>
                                {report.description && (
                                  <p className="text-sm text-muted-foreground mt-1 bg-muted/50 p-2 rounded">
                                    "{report.description}"
                                  </p>
                                )}
                              </div>

                              {/* Reporter info */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                  <i className="fas fa-user mr-1"></i>
                                  {report.reporterName || 'Anonymous'}
                                </span>
                                {report.reporterEmail && (
                                  <span>
                                    <i className="fas fa-envelope mr-1"></i>
                                    {report.reporterEmail}
                                  </span>
                                )}
                              </div>

                              {/* Admin notes if any */}
                              {report.adminNotes && (
                                <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                                  <span className="font-medium">Admin Notes:</span> {report.adminNotes}
                                </div>
                              )}

                              {/* Action buttons */}
                              {report.status === 'pending' && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdateReportStatus(report.id, 'reviewed')}
                                    disabled={processingReport === report.id}
                                  >
                                    {processingReport === report.id ? (
                                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <i className="fas fa-eye mr-1.5"></i>
                                        Mark Reviewed
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                                    disabled={processingReport === report.id}
                                  >
                                    <i className="fas fa-check mr-1.5"></i>
                                    Dismiss
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteReportedContent(report)}
                                    disabled={processingReport === report.id}
                                  >
                                    <i className="fas fa-trash mr-1.5"></i>
                                    Delete Content
                                  </Button>
                                </div>
                              )}
                              
                              {report.status === 'reviewed' && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleUpdateReportStatus(report.id, 'resolved')}
                                    disabled={processingReport === report.id}
                                  >
                                    <i className="fas fa-check-circle mr-1.5"></i>
                                    Mark Resolved
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                                    disabled={processingReport === report.id}
                                  >
                                    <i className="fas fa-times mr-1.5"></i>
                                    Dismiss
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteReportedContent(report)}
                                    disabled={processingReport === report.id}
                                  >
                                    <i className="fas fa-trash mr-1.5"></i>
                                    Delete Content
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Manage Content Tab */}
            <TabsContent value="manage" className="p-4 sm:p-6 mt-0">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base sm:text-lg">Content Management</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  {/* Filters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    <div>
                      <Label className="text-xs sm:text-sm">Semester</Label>
                      <Select value={manageSemester} onValueChange={handleManageSemesterChange}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="All Semesters" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem key="all-sem" value="all">All Semesters</SelectItem>
                          {SEMESTER_OPTIONS.map(o => (
                            <SelectItem key={`manage-sem-${o.value}`} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-1 lg:col-span-2">
                      <Label className="text-xs sm:text-sm">Subject</Label>
                      <Select
                        value={manageSubjectId}
                        onValueChange={setManageSubjectId}
                        disabled={manageSemester === 'all'}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem key="all-subj" value="all">All Subjects</SelectItem>
                          {Object.entries(subjectsBySem[manageSemester] || {}).map(([id, subj]) => (
                            <SelectItem key={`manage-sub-${manageSemester}:${id}`} value={id}>
                              {(subj as any).name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Loading State */}
                  {loadingContent && (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Loading content...
                    </div>
                  )}

                  {/* Empty State */}
                  {!loadingContent && filteredContent.length === 0 && (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      <i className="fas fa-inbox text-3xl mb-2 opacity-50"></i>
                      <p>No content found for the selected filters.</p>
                    </div>
                  )}

                  {/* Content List */}
                  <ScrollArea className="h-[400px] sm:h-[500px]">
                    <div className="space-y-3 pr-4">
                      {filteredContent.slice(0, 20).map((item) => (
                        <div key={`${item.category}:${item.semester}:${item.subjectId}:${item.id}`} className="p-3 sm:p-4 border rounded-lg bg-card">
                          {editItemId === item.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-xs">Type</Label>
                                  <Select value={editForm.category} onValueChange={(v: 'notes' | 'videos') => setEditForm(prev => ({ ...prev, category: v }))}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="notes">Notes</SelectItem>
                                      <SelectItem value="videos">Videos</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Semester</Label>
                                  <Select value={editForm.semester} onValueChange={async (v) => { setEditForm(prev => ({ ...prev, semester: v, subjectId: '' })); await ensureSubjects(v); }}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select semester" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SEMESTER_OPTIONS.map(o => (
                                        <SelectItem key={`edit-sem-${o.value}`} value={o.value}>{o.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="sm:col-span-2">
                                  <Label className="text-xs">Subject</Label>
                                  <Select value={editForm.subjectId} onValueChange={(v) => setEditForm(prev => ({ ...prev, subjectId: v }))} disabled={!editForm.semester}>
                                    <SelectTrigger className="mt-1">
                                      <SelectValue placeholder="Select subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(subjectsBySem[editForm.semester] || {}).map(([id, s]) => (
                                        <SelectItem key={`edit-sub-${editForm.semester}:${id}`} value={id}>{(s as any).name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">Title</Label>
                                  <Input value={editForm.title} onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))} className="mt-1" />
                                </div>
                                <div>
                                  <Label className="text-xs">Description</Label>
                                  <Input value={editForm.description} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} className="mt-1" />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">{editForm.category === 'notes' ? 'Note URL' : 'Video URL'}</Label>
                                <Input value={editForm.url || ''} onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))} placeholder={editForm.category === 'notes' ? 'https://drive.google.com/...' : 'https://...'} className="mt-1" />
                              </div>
                              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                                <Button variant="outline" size="sm" onClick={() => setEditItemId(null)}>Cancel</Button>
                                <Button size="sm" onClick={async () => {
                                  try {
                                    if (!editForm.semester || !editForm.subjectId || !editForm.title) {
                                      toast({ title: 'Missing fields', description: 'Semester, subject and title are required', variant: 'destructive' });
                                      return;
                                    }
                                    await firebaseService.updateContent(item, {
                                      semester: editForm.semester,
                                      subjectId: editForm.subjectId,
                                      category: editForm.category,
                                      title: editForm.title,
                                      description: editForm.description,
                                      url: editForm.url || '',
                                    });
                                    toast({ title: 'Updated', description: 'Content updated successfully' });
                                    setEditItemId(null);
                                    await loadAllContent();
                                  } catch (e: any) {
                                    toast({ title: 'Update failed', description: e?.message || 'Try again', variant: 'destructive' });
                                  }
                                }}>Save Changes</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`${item.category === 'notes' ? 'bg-primary/10' : 'bg-red-100 dark:bg-red-900/30'} w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0`}>
                                  <i className={`${item.category === 'notes' ? 'fas fa-file-pdf text-primary' : 'fas fa-play-circle text-red-600'} text-sm sm:text-base`}></i>
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-medium text-sm sm:text-base truncate">{item.title}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {formatTimestamp(item.timestamp)} • {item.category === 'notes' ? `${(item as Note).downloads} downloads` : `${(item as Video).views} views`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:shrink-0">
                                <Badge variant={item.category === 'notes' ? 'default' : 'destructive'} className="text-xs">
                                  {item.category.toUpperCase()}
                                </Badge>
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={async () => {
                                  setEditItemId(item.id);
                                  await ensureSubjects(item.semester);
                                  setEditForm({
                                    scheme: item.scheme || selectedScheme,
                                    semester: item.semester,
                                    subjectId: item.subjectId,
                                    category: item.category,
                                    title: item.title,
                                    description: item.description || '',
                                    url: (item as any).url || '',
                                  });
                                }}>Edit</Button>
                                <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => handleDeleteItem(item)} disabled={deletingId === item.id}>
                                  {deletingId === item.id ? '...' : 'Delete'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Schemes & Subjects Tab */}
            <TabsContent value="schemes" className="p-4 sm:p-6 mt-0">
              <div className="space-y-6">
                {/* Scheme Management */}
                <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <i className="fas fa-graduation-cap text-purple-600"></i>
                        Scheme Management
                      </CardTitle>
                      <Dialog open={isCreateSchemeOpen} onOpenChange={setIsCreateSchemeOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2">
                            <i className="fas fa-plus"></i>
                            New Scheme
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Create New Scheme</DialogTitle>
                            <DialogDescription>
                              Add a new curriculum scheme. You can then add subjects to it.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label>Scheme Year *</Label>
                              <Input
                                type="number"
                                placeholder="e.g., 2024"
                                value={newSchemeYear}
                                onChange={(e) => setNewSchemeYear(e.target.value)}
                                className="mt-1.5"
                                min={2000}
                                max={2100}
                              />
                            </div>
                            <div>
                              <Label>Description (Optional)</Label>
                              <Input
                                placeholder="e.g., KTU 2024 Updated Curriculum"
                                value={newSchemeDescription}
                                onChange={(e) => setNewSchemeDescription(e.target.value)}
                                className="mt-1.5"
                              />
                            </div>
                          </div>
                          <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setIsCreateSchemeOpen(false)} disabled={creatingScheme}>
                              Cancel
                            </Button>
                            <Button onClick={handleCreateScheme} disabled={creatingScheme || !newSchemeYear}>
                              {creatingScheme ? "Creating..." : "Create Scheme"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {loadingSchemes ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">Loading schemes...</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {schemes.map(scheme => (
                          <div key={scheme.id} className="p-4 border rounded-lg bg-card">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold">{scheme.name}</h4>
                              {scheme.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{scheme.description}</p>
                            <div className="text-xs text-muted-foreground">
                              Created: {new Date(scheme.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subject Management */}
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <i className="fas fa-book text-blue-600"></i>
                        Subject Management
                      </CardTitle>
                      <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="gap-2">
                            <i className="fas fa-plus"></i>
                            Add Subject
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add New Subject</DialogTitle>
                            <DialogDescription>
                              Add a subject to the {selectedScheme} scheme.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div>
                              <Label>Semester *</Label>
                              <Select value={newSubjectSemester} onValueChange={setNewSubjectSemester}>
                                <SelectTrigger className="mt-1.5">
                                  <SelectValue placeholder="Select semester" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SEMESTER_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Subject ID *</Label>
                              <Input
                                placeholder="e.g., CS301"
                                value={newSubjectId}
                                onChange={(e) => setNewSubjectId(e.target.value)}
                                className="mt-1.5"
                              />
                              <p className="text-xs text-muted-foreground mt-1">Unique identifier (no spaces)</p>
                            </div>
                            <div>
                              <Label>Subject Name *</Label>
                              <Input
                                placeholder="e.g., Data Structures"
                                value={newSubjectName}
                                onChange={(e) => setNewSubjectName(e.target.value)}
                                className="mt-1.5"
                              />
                            </div>
                          </div>
                          <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setIsAddSubjectOpen(false)} disabled={addingSubject}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddSubject} disabled={addingSubject || !newSubjectName || !newSubjectId || !newSubjectSemester}>
                              {addingSubject ? "Adding..." : "Add Subject"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {/* Scheme and Semester Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div>
                        <Label className="text-xs">Scheme</Label>
                        <Select value={selectedScheme} onValueChange={handleSchemeSubjectsChange}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select scheme" />
                          </SelectTrigger>
                          <SelectContent>
                            {schemes.map(scheme => (
                              <SelectItem key={scheme.id} value={scheme.id}>{scheme.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Semester</Label>
                        <Select value={schemeSubjectsSemester} onValueChange={handleSchemeSubjectsSemesterChange}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select semester" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEMESTER_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Subject List */}
                    {loadingSchemeSubjects ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">Loading subjects...</div>
                    ) : Object.keys(schemeSubjects).length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                          <i className="fas fa-book text-muted-foreground"></i>
                        </div>
                        <p className="text-sm text-muted-foreground">No subjects found for this semester.</p>
                        <p className="text-xs text-muted-foreground mt-1">Click "Add Subject" to create one.</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2 pr-4">
                          {Object.entries(schemeSubjects).map(([id, subject]) => (
                            <div key={id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                              {editingSubjectId === id ? (
                                <>
                                  <div className="flex-1 mr-2">
                                    <Input
                                      value={editSubjectName}
                                      onChange={(e) => setEditSubjectName(e.target.value)}
                                      className="h-8 text-sm"
                                      placeholder="Subject name"
                                      autoFocus
                                    />
                                    <div className="text-xs text-muted-foreground mt-1">ID: {id}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={handleSaveSubjectEdit}
                                      disabled={savingSubject || !editSubjectName.trim()}
                                    >
                                      {savingSubject ? "..." : "Save"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={handleCancelSubjectEdit}
                                      disabled={savingSubject}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <div className="font-medium text-sm">{(subject as any).name}</div>
                                    <div className="text-xs text-muted-foreground">ID: {id}</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs"
                                      onClick={() => handleEditSubject(id, (subject as any).name)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-destructive hover:text-destructive h-8 text-xs"
                                      onClick={() => handleDeleteSubject(id)}
                                      disabled={deletingSubjectId === id}
                                    >
                                      {deletingSubjectId === id ? "..." : "Delete"}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="statistics" className="p-4 sm:p-6 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base sm:text-lg">Content Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {loadingContent ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm">Total Content Items</span>
                          <span className="font-semibold">{content.length}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm">PDF Notes</span>
                          <span className="font-semibold text-primary">
                            {content.filter(item => item.category === "notes").length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm">Video Resources</span>
                          <span className="font-semibold text-red-600">
                            {content.filter(item => item.category === "videos").length}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base sm:text-lg">Engagement Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    {loadingContent ? (
                      <div className="text-sm text-muted-foreground py-4 text-center">
                        <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm">Total Downloads</span>
                          <span className="font-semibold text-blue-600">{totalDownloads}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm">Total Video Views</span>
                          <span className="font-semibold text-green-600">{totalViews}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <span className="text-sm">Avg. Downloads per Note</span>
                          <span className="font-semibold">
                            {content.filter(item => item.category === "notes").length > 0 
                              ? Math.round(totalDownloads / content.filter(item => item.category === "notes").length * 10) / 10
                              : 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* User Management Tab (Super Admin Only) */}
            {isSuperAdmin && (
              <TabsContent value="users" className="p-4 sm:p-6 mt-0">
                <div className="space-y-4 sm:space-y-6">
                  {/* Add Admin Section */}
                  <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base sm:text-lg">Admin Management</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-4">
                      {/* Promote User */}
                      <div>
                        <Label className="text-sm font-medium">Promote User to Admin</Label>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                          <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select user to promote" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.filter(u => {
                                const r = (u.role || '').toLowerCase();
                                return r === 'student' || r === '';
                              }).map(u => (
                                <SelectItem key={`${u.uid}:${u.email}`} value={u.uid}>
                                  {u.name} ({u.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={handlePromoteUser} disabled={!selectedUser} className="bg-orange-600 hover:bg-orange-700 shrink-0">
                            Promote
                          </Button>
                        </div>
                      </div>

                      {/* Add Admin by Email */}
                      <div>
                        <Label className="text-sm font-medium">Add Admin by Email</Label>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                          <Input 
                            placeholder="email@domain.com" 
                            value={newAdminEmail} 
                            onChange={(e) => setNewAdminEmail(e.target.value)} 
                            className="flex-1"
                          />
                          <Button onClick={handleAddAdmin} disabled={addingAdmin} className="shrink-0">
                            {addingAdmin ? 'Adding...' : 'Add Admin'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Current Admins */}
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base sm:text-lg">Current Admins</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      {admins.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No admins configured.</p>
                      ) : (
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-2 pr-4">
                            {admins.map(a => (
                              <div key={`admin:${a.key}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                                <div className="min-w-0">
                                  <div className="font-medium text-sm truncate">{a.email}</div>
                                  <div className="text-xs text-muted-foreground">{a.role}</div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-8 text-destructive hover:text-destructive shrink-0"
                                  onClick={() => handleRemoveAdmin(a.key)}
                                  disabled={removingAdminKey === a.key}
                                >
                                  {removingAdminKey === a.key ? 'Removing...' : 'Remove'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  {/* All Users */}
                  <Card>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-base sm:text-lg">All Users ({users.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2 pr-4">
                          {users.map((user, idx) => (
                            <div key={`${user.uid || user.email || idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg">
                              <div className="min-w-0">
                                <h4 className="font-medium text-sm truncate">{user.name}</h4>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>
                              <Badge 
                                variant={
                                  user.role === "superadmin" ? "default" : 
                                  user.role === "admin" ? "secondary" : "outline"
                                }
                                className="text-xs shrink-0"
                              >
                                {user.role}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}