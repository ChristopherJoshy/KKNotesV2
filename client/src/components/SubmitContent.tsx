import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { firebaseService } from "@/lib/firebaseAdmin";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

interface SubmitContentProps {
  trigger?: React.ReactNode;
}

export function SubmitContent({ trigger }: SubmitContentProps) {
  const { user, isAuthenticated, login } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [loginPromptOpen, setLoginPromptOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [subjects, setSubjects] = React.useState<Record<string, any>>({});
  const [schemes, setSchemes] = React.useState<Array<{ id: string; name: string; year: number; description?: string }>>([]);
  const [loadingSchemes, setLoadingSchemes] = React.useState(false);
  const [loadingSubjects, setLoadingSubjects] = React.useState(false);
  
  const [form, setForm] = React.useState({
    scheme: "2019",
    semester: "",
    subjectId: "",
    title: "",
    description: "",
    url: "",
    contentType: "notes" as "notes" | "videos",
    submitterName: "",
    submitterEmail: ""
  });

  // Load schemes on mount
  React.useEffect(() => {
    loadSchemes();
  }, []);

  const loadSchemes = async () => {
    setLoadingSchemes(true);
    try {
      const schemesData = await firebaseService.getSchemes();
      setSchemes(schemesData);
    } catch (error) {
      console.error('Error loading schemes:', error);
    } finally {
      setLoadingSchemes(false);
    }
  };

  const loadSubjects = async (semester: string, scheme: string) => {
    setLoadingSubjects(true);
    setSubjects({});
    try {
      const semesterSubjects = await firebaseService.getSubjects(semester, scheme);
      console.log('Loaded subjects for', semester, scheme, ':', semesterSubjects);
      setSubjects(semesterSubjects || {});
    } catch (error) {
      console.error('Error loading subjects:', error);
      setSubjects({});
    } finally {
      setLoadingSubjects(false);
    }
  };

  const handleSchemeChange = (scheme: string) => {
    setForm(prev => ({ ...prev, scheme, subjectId: "" }));
    setSubjects({});
    if (form.semester) {
      loadSubjects(form.semester, scheme);
    }
  };

  const handleSemesterChange = (semester: string) => {
    setForm(prev => ({ ...prev, semester, subjectId: "" }));
    setSubjects({});
    loadSubjects(semester, form.scheme);
  };

  const validateUrl = (url: string, type: "notes" | "videos"): boolean => {
    if (!url.trim()) return false;
    
    try {
      new URL(url);
      
      if (type === "videos") {
        // Accept YouTube URLs
        return url.includes("youtube.com") || url.includes("youtu.be") || url.startsWith("https://");
      }
      
      // For notes, accept Google Drive, Dropbox, or any HTTPS URL
      return url.startsWith("https://");
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!form.scheme || !form.semester || !form.subjectId || !form.title || !form.url) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (!validateUrl(form.url, form.contentType)) {
      toast({
        title: "Invalid URL",
        description: form.contentType === "videos" 
          ? "Please enter a valid YouTube or video URL." 
          : "Please enter a valid HTTPS URL for notes.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    
    try {
      // Create a pending submission that requires admin approval
      const submissionId = await firebaseService.createPendingSubmission({
        scheme: form.scheme,
        semester: form.semester,
        subjectId: form.subjectId,
        title: form.title,
        description: form.description || "",
        url: form.url,
        contentType: form.contentType,
        submittedBy: user?.uid || form.submitterEmail || "anonymous",
        submitterName: form.submitterName || user?.name,
        submitterEmail: form.submitterEmail || user?.email,
      });

      // Notify the submitter if they are logged in
      if (user?.uid) {
        await firebaseService.createNotification({
          userId: user.uid,
          type: 'submission_pending',
          title: 'Submission Received',
          message: `Your ${form.contentType === 'notes' ? 'note' : 'video'} "${form.title}" has been submitted and is awaiting admin approval.`,
          contentId: submissionId,
          contentType: form.contentType,
        });
      }

      // Notify all admins about the new pending submission
      const pendingSubmission = {
        id: submissionId,
        scheme: form.scheme,
        semester: form.semester,
        subjectId: form.subjectId,
        title: form.title,
        description: form.description || "",
        url: form.url,
        contentType: form.contentType,
        submittedBy: user?.uid || form.submitterEmail || "anonymous",
        submitterName: form.submitterName || user?.name,
        submitterEmail: form.submitterEmail || user?.email,
        submittedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        status: "pending" as const,
      };
      await firebaseService.notifyAdminsOfPendingSubmission(pendingSubmission);
      
      toast({
        title: "Submission Received!",
        description: "Thank you! Your content has been submitted for review. Admins will approve it shortly.",
      });
      
      // Reset form and close dialog
      setForm({
        scheme: "2019",
        semester: "",
        subjectId: "",
        title: "",
        description: "",
        url: "",
        contentType: "notes",
        submitterName: "",
        submitterEmail: ""
      });
      setOpen(false);
    } catch (error) {
      console.error('Error submitting content:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Login Prompt Dialog */}
      <Dialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <i className="fas fa-sign-in-alt text-primary"></i>
              Sign in to Submit
            </DialogTitle>
            <DialogDescription>
              You need to sign in with your Google account to submit notes or videos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button onClick={() => { login(); setLoginPromptOpen(false); }} className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>
            <Button variant="outline" onClick={() => setLoginPromptOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(newOpen) => {
        // Only open if authenticated
        if (newOpen && !isAuthenticated) {
          setLoginPromptOpen(true);
          return;
        }
        setOpen(newOpen);
      }}>
        <DialogTrigger asChild>
            {trigger || (
              <Button variant="outline" className="gap-2">
                <i className="fas fa-plus"></i>
                <span className="hidden sm:inline">Submit Content</span>
                <span className="sm:hidden">Submit</span>
              </Button>
            )}
        </DialogTrigger>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <i className="fas fa-share-alt text-primary"></i>
            Share Your Resources
          </DialogTitle>
          <DialogDescription>
            Help fellow students by sharing notes or video links. Submissions will be reviewed by admins before appearing publicly. Pending submissions expire after 30 days.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Content Type Selection */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={form.contentType === "notes" ? "default" : "outline"}
              onClick={() => setForm(prev => ({ ...prev, contentType: "notes" }))}
              className="w-full gap-2"
            >
              <i className="fas fa-file-pdf"></i>
              Notes
            </Button>
            <Button
              type="button"
              variant={form.contentType === "videos" ? "default" : "outline"}
              onClick={() => setForm(prev => ({ ...prev, contentType: "videos" }))}
              className="w-full gap-2"
            >
              <i className="fas fa-play-circle"></i>
              Video
            </Button>
          </div>

          {/* Scheme Selection */}
          <div>
            <Label className="text-sm">Scheme *</Label>
            <Select value={form.scheme} onValueChange={handleSchemeChange} disabled={loadingSchemes}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={loadingSchemes ? "Loading schemes..." : "Select scheme"} />
              </SelectTrigger>
              <SelectContent>
                {schemes.map((scheme) => (
                  <SelectItem key={scheme.id} value={scheme.id}>
                    {scheme.year} Scheme
                    {scheme.description && ` - ${scheme.description}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Select the curriculum scheme this content belongs to
            </p>
          </div>

          {/* Semester and Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Semester *</Label>
              <Select value={form.semester} onValueChange={handleSemesterChange}>
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
              <Label className="text-sm">Subject *</Label>
              <Select 
                value={form.subjectId} 
                onValueChange={(v) => setForm(prev => ({ ...prev, subjectId: v }))}
                disabled={!form.semester || loadingSubjects}
              >
                <SelectTrigger className="mt-1.5 min-h-[44px]">
                  <SelectValue placeholder={
                    !form.semester 
                      ? "Select semester first" 
                      : loadingSubjects 
                        ? "Loading subjects..." 
                        : Object.keys(subjects).length === 0 
                          ? "No subjects available" 
                          : "Select subject"
                  } />
                </SelectTrigger>
                <SelectContent 
                  className="max-h-[300px] overflow-y-auto z-[9999]"
                  position="popper"
                  sideOffset={4}
                >
                  {Object.entries(subjects).map(([id, subject]) => (
                    <SelectItem 
                      key={id} 
                      value={id}
                      className="min-h-[44px] py-3"
                    >
                      {(subject as any).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div>
            <Label className="text-sm">Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder={form.contentType === "notes" ? "e.g., Module 1 Complete Notes" : "e.g., Data Structures Tutorial"}
              className="mt-1.5"
            />
          </div>

          {/* URL */}
          <div>
            <Label className="text-sm">{form.contentType === "notes" ? "Notes Link *" : "Video URL *"}</Label>
            <Input
              value={form.url}
              onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
              placeholder={form.contentType === "notes" 
                ? "https://drive.google.com/..." 
                : "https://youtube.com/watch?v=..."
              }
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {form.contentType === "notes" 
                ? "Google Drive, Dropbox, or any direct link" 
                : "YouTube or other video platform links"
              }
            </p>
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm">Description (Optional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what's covered..."
              rows={2}
              className="mt-1.5"
            />
          </div>

          {/* Submitter Info (if not logged in) */}
          {!isAuthenticated && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <Label className="text-sm">Your Name (Optional)</Label>
                <Input
                  value={form.submitterName}
                  onChange={(e) => setForm(prev => ({ ...prev, submitterName: e.target.value }))}
                  placeholder="Your name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm">Your Email (Optional)</Label>
                <Input
                  type="email"
                  value={form.submitterEmail}
                  onChange={(e) => setForm(prev => ({ ...prev, submitterEmail: e.target.value }))}
                  placeholder="your@email.com"
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 gap-2"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i>
                Submit
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
