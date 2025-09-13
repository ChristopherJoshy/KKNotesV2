import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firebaseService } from "@/lib/firebaseAdmin";
import { InsertNote, Note } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

interface AdminPanelProps {
  onClose: () => void;
}

const SEMESTER_OPTIONS = [
  { value: "semester1", label: "Semester 1" },
  { value: "semester2", label: "Semester 2" },
  { value: "semester3", label: "Semester 3" },
  { value: "semester4", label: "Semester 4" },
  { value: "semester5", label: "Semester 5" },
  { value: "semester6", label: "Semester 6" },
  { value: "semester7", label: "Semester 7" },
  { value: "semester8", label: "Semester 8" },
];

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [uploadForm, setUploadForm] = useState({
    semester: "",
    subjectId: "",
    title: "",
    description: "",
    file: null as File | null
  });
  const [subjects, setSubjects] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadAllNotes();
  }, []);

  const loadAllNotes = async () => {
    try {
      // Load notes from all semesters and subjects for statistics
      const allNotes: Note[] = [];
      const semesters = ['semester1', 'semester2', 'semester3', 'semester4', 'semester5', 'semester6', 'semester7', 'semester8'];
      
      for (const semester of semesters) {
        const semesterSubjects = await firebaseService.getSubjects(semester);
        for (const [subjectId] of Object.entries(semesterSubjects)) {
          const subjectNotes = await firebaseService.getNotesBySubject(semester, subjectId);
          allNotes.push(...subjectNotes);
        }
      }
      
      setNotes(allNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const loadSubjects = async (semester: string) => {
    try {
      const semesterSubjects = await firebaseService.getSubjects(semester);
      setSubjects(semesterSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
      toast({
        title: "Error",
        description: "Failed to load subjects",
        variant: "destructive"
      });
    }
  };

  const handleSemesterChange = (semester: string) => {
    setUploadForm(prev => ({ ...prev, semester, subjectId: "" }));
    loadSubjects(semester);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: "Invalid File",
          description: "Please select a PDF file",
          variant: "destructive"
        });
        return;
      }
      setUploadForm(prev => ({ ...prev, file }));
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.semester || !uploadForm.subjectId || !uploadForm.title || !uploadForm.file) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields and select a file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    try {
      const noteData: InsertNote = {
        semester: uploadForm.semester,
        subjectId: uploadForm.subjectId,
        title: uploadForm.title,
        description: uploadForm.description,
        url: "", // Will be set by firebaseService
  uploadedBy: "admin", // TODO: Use actual user ID
  category: 'notes'
      };

      await firebaseService.createNote(noteData, uploadForm.file);
      
      toast({
        title: "Success",
        description: "Note uploaded successfully"
      });

      // Reload notes to update statistics
      await loadAllNotes();

      // Reset form
      setUploadForm({
        semester: "",
        subjectId: "",
        title: "",
        description: "",
        file: null
      });
    } catch (error) {
      console.error('Error uploading note:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload note. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-12 fade-in">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Admin Panel</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Admin Access</span>
              <Button data-testid="button-close-admin" onClick={onClose} variant="secondary">
                Back to Notes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Upload Notes Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-upload text-primary"></i>
                  </div>
                  <span>Upload Notes</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="semester">Semester</Label>
                    <Select value={uploadForm.semester} onValueChange={handleSemesterChange}>
                      <SelectTrigger data-testid="select-upload-semester">
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
                    <Label htmlFor="subject">Subject</Label>
                    <Select 
                      value={uploadForm.subjectId} 
                      onValueChange={(value) => setUploadForm(prev => ({ ...prev, subjectId: value }))}
                      disabled={!uploadForm.semester}
                    >
                      <SelectTrigger data-testid="select-upload-subject">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(subjects).map(([id, subject]) => (
                          <SelectItem key={id} value={id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title">Note Title</Label>
                  <Input
                    data-testid="input-note-title"
                    id="title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter note title"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    data-testid="textarea-note-description"
                    id="description"
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the note content"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="file">PDF File</Label>
                  <Input
                    data-testid="input-note-file"
                    id="file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="file:bg-primary/10 file:text-primary file:border-0 file:rounded-md file:px-3 file:py-1"
                  />
                </div>

                <Button
                  data-testid="button-upload-note"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    'Upload Note'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Statistics Card */}
            <Card className="bg-chart-2/5 border-chart-2/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-2/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-chart-bar text-chart-2"></i>
                  </div>
                  <span>Statistics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Notes</span>
                    <span data-testid="stat-total-notes" className="font-semibold">
                      {notes.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Downloads</span>
                    <span data-testid="stat-total-downloads" className="font-semibold">
                      {notes.reduce((sum, note) => sum + (note.downloads || 0), 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Most Popular</span>
                    <span data-testid="stat-most-popular" className="font-semibold text-xs">
                      {notes.length > 0 
                        ? notes.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))[0]?.title?.substring(0, 20) + "..."
                        : "N/A"
                      }
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notes.slice(0, 5).map((note) => (
                  <div key={note.id} className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <i className="fas fa-upload text-primary text-xs"></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-card-foreground">New notes uploaded</p>
                      <p className="text-xs text-muted-foreground">
                        {note.title} • {formatTimestamp(note.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTimestamp(timestamp: number) {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}
