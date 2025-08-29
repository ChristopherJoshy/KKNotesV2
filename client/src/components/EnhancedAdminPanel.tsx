import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { firebaseService } from "@/lib/firebaseAdmin";
import { InsertNote, InsertVideo, Note, Video, User, ContentItem } from "@shared/schema";
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

  // Content upload form
  const [uploadForm, setUploadForm] = useState({
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
  const [editForm, setEditForm] = useState<{ semester: string; subjectId: string; category: 'notes' | 'videos'; title: string; description: string; url?: string }>({
    semester: '', subjectId: '', category: 'notes', title: '', description: '', url: ''
  });
  const [manageSemester, setManageSemester] = useState<string>('all');
  const [manageSubjectId, setManageSubjectId] = useState<string>('all');

  useEffect(() => {
    loadAllContent();
    if (isSuperAdmin) {
      loadAllUsers();
  loadAdmins();
    }
  }, [isSuperAdmin]);

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

  const loadSubjects = async (semester: string) => {
    try {
      const semesterSubjects = await firebaseService.getSubjects(semester);
      setSubjects(semesterSubjects);
  setSubjectsBySem(prev => ({ ...prev, [semester]: semesterSubjects }));
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

  const ensureSubjects = async (semester: string) => {
    if (!subjectsBySem[semester]) {
      const s = await firebaseService.getSubjects(semester);
      setSubjectsBySem(prev => ({ ...prev, [semester]: s }));
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
    if (!uploadForm.semester || !uploadForm.subjectId || !uploadForm.title) {
      toast({
        title: "Missing Information",
        description: "Please fill all required fields",
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
        const noteData: InsertNote = {
          semester: uploadForm.semester,
          subjectId: uploadForm.subjectId,
          title: uploadForm.title,
          description: uploadForm.description,
          url: uploadForm.url,
          uploadedBy: user?.uid || "admin",
          category: "notes"
        };

        await firebaseService.createNote(noteData);
      } else {
        const videoData: InsertVideo = {
          semester: uploadForm.semester,
          subjectId: uploadForm.subjectId,
          title: uploadForm.title,
          description: uploadForm.description,
          url: uploadForm.url,
          uploadedBy: user?.uid || "admin",
          category: "videos"
        };

        await firebaseService.createVideo(videoData);
      }
      
      toast({
        title: "Success",
        description: `${uploadForm.category === "notes" ? "Note" : "Video"} uploaded successfully`
      });

      // Reload content to update statistics
      await loadAllContent();

      // Reset form
      setUploadForm({
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
      await firebaseService.addAdmin({ email, addedBy: user?.email || undefined });
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
    setRemovingAdminKey(adminKey);
    try {
      await firebaseService.removeAdminByKey(adminKey);
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
    <div className="mt-12 fade-in">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Enhanced Admin Panel</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant={isSuperAdmin ? "default" : "secondary"}>
                {isSuperAdmin ? "Super Admin" : "Admin"}
              </Badge>
              <Button data-testid="button-close-admin" onClick={onClose} variant="secondary">
                Back to Portal
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upload">Upload Content</TabsTrigger>
              <TabsTrigger value="manage">Manage Content</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="users">User Management</TabsTrigger>}
            </TabsList>

            {/* Upload Content Tab */}
            <TabsContent value="upload">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <i className="fas fa-upload text-primary"></i>
                      </div>
                      <span>Upload Content</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="category">Content Type</Label>
                      <Select 
                        value={uploadForm.category} 
                        onValueChange={(value: "notes" | "videos") => 
                          setUploadForm(prev => ({ ...prev, category: value }))
                        }
                      >
                        <SelectTrigger data-testid="select-content-category">
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="notes">Notes (Link)</SelectItem>
                          <SelectItem value="videos">Videos (URL)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

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
                              <SelectItem key={`${uploadForm.semester}:${id}`} value={id}>
                                {subject.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        data-testid="input-content-title"
                        id="title"
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder={`Enter ${uploadForm.category} title`}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Textarea
                        data-testid="textarea-content-description"
                        id="description"
                        value={uploadForm.description}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the content"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="contentUrl">{uploadForm.category === 'notes' ? 'Note URL' : 'Video URL'}</Label>
                      <Input
                        data-testid="input-content-url"
                        id="contentUrl"
                        value={uploadForm.url}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, url: e.target.value }))}
                        placeholder={uploadForm.category === 'notes' ? 'https://drive.google.com/...' : 'https://youtube.com/watch?v=...'}
                      />
                    </div>

                    <Button
                      data-testid="button-upload-content"
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
                        `Upload ${uploadForm.category === "notes" ? "Note" : "Video"}`
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card className="bg-chart-2/5 border-chart-2/20">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-chart-2/10 rounded-lg flex items-center justify-center">
                        <i className="fas fa-chart-bar text-chart-2"></i>
                      </div>
                      <span>Quick Statistics</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-background/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {content.filter(item => item.category === "notes").length}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Notes</div>
                      </div>
                      <div className="text-center p-4 bg-background/50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {content.filter(item => item.category === "videos").length}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Videos</div>
                      </div>
                      <div className="text-center p-4 bg-background/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {totalDownloads}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Downloads</div>
                      </div>
                      <div className="text-center p-4 bg-background/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {totalViews}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Views</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Manage Content Tab */}
            <TabsContent value="manage">
              <Card>
                <CardHeader>
                  <CardTitle>Content Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loadingContent && (
                      <div className="text-sm text-muted-foreground">Loading content…</div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label>Semester</Label>
                        <Select value={manageSemester} onValueChange={handleManageSemesterChange}>
                          <SelectTrigger>
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
                      <div className="md:col-span-2">
                        <Label>Subject</Label>
                        <Select
                          value={manageSubjectId}
                          onValueChange={setManageSubjectId}
                          disabled={manageSemester === 'all'}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All Subjects" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem key="all-subj" value="all">All Subjects</SelectItem>
                            {Object.entries(subjectsBySem[manageSemester] || {}).map(([id, subj]) => (
                              <SelectItem key={`manage-sub-${manageSemester}:${id}`} value={id}>
                                {(subj as any).name
                                }
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {!loadingContent && filteredContent.length === 0 && (
                      <div className="text-sm text-muted-foreground">No content found for the selected filters.</div>
                    )}
                    {filteredContent.slice(0, 10).map((item) => (
                      <div key={`${item.category}:${item.semester}:${item.subjectId}:${item.id}`} className="p-4 border rounded-lg">
                        {editItemId === item.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                              <div>
                                <Label>Type</Label>
                                <Select value={editForm.category} onValueChange={(v: 'notes' | 'videos') => setEditForm(prev => ({ ...prev, category: v }))}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="notes">Notes</SelectItem>
                                    <SelectItem value="videos">Videos</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Semester</Label>
                                <Select value={editForm.semester} onValueChange={async (v) => { setEditForm(prev => ({ ...prev, semester: v, subjectId: '' })); await ensureSubjects(v); }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select semester" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SEMESTER_OPTIONS.map(o => (
                                      <SelectItem key={`edit-sem-${o.value}`} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-2">
                                <Label>Subject</Label>
                                <Select value={editForm.subjectId} onValueChange={(v) => setEditForm(prev => ({ ...prev, subjectId: v }))} disabled={!editForm.semester}>
                                  <SelectTrigger>
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label>Title</Label>
                                <Input value={editForm.title} onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))} />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Input value={editForm.description} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <Label>{editForm.category === 'notes' ? 'Note URL' : 'Video URL'}</Label>
                              <Input value={editForm.url || ''} onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))} placeholder={editForm.category === 'notes' ? 'https://drive.google.com/...' : 'https://...'} />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" onClick={() => setEditItemId(null)}>Cancel</Button>
                              <Button onClick={async () => {
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`${item.category === 'notes' ? 'bg-primary/10' : 'bg-red-100'} w-10 h-10 rounded-lg flex items-center justify-center`}>
                                <i className={`${item.category === 'notes' ? 'fas fa-file-pdf text-primary' : 'fas fa-play-circle text-red-600'} text-lg`}></i>
                              </div>
                              <div>
                                <h4 className="font-medium">{item.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {formatTimestamp(item.timestamp)} • {item.category === 'notes' ? ` ${(item as Note).downloads} downloads` : ` ${(item as Video).views} views`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={item.category === 'notes' ? 'default' : 'destructive'}>{item.category.toUpperCase()}</Badge>
                              <Button variant="outline" size="sm" onClick={async () => {
                                setEditItemId(item.id);
                                await ensureSubjects(item.semester);
                                setEditForm({
                                  semester: item.semester,
                                  subjectId: item.subjectId,
                                  category: item.category,
                                  title: item.title,
                                  description: item.description || '',
                                  url: (item as any).url || '',
                                });
                              }}>Edit</Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteItem(item)} disabled={deletingId === item.id}>
                                {deletingId === item.id ? 'Deleting...' : 'Delete'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Statistics Tab */}
            <TabsContent value="statistics">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Content Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {loadingContent && (
                        <div className="text-sm text-muted-foreground">Loading statistics…</div>
                      )}
                      <div className="flex justify-between">
                        <span>Total Content Items</span>
                        <span className="font-semibold">{content.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PDF Notes</span>
                        <span className="font-semibold text-primary">
                          {content.filter(item => item.category === "notes").length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Video Resources</span>
                        <span className="font-semibold text-red-600">
                          {content.filter(item => item.category === "videos").length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Engagement Stats</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <span>Total Downloads</span>
                        <span className="font-semibold text-blue-600">{totalDownloads}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Video Views</span>
                        <span className="font-semibold text-green-600">{totalViews}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Avg. Downloads per Note</span>
                        <span className="font-semibold">
                          {content.filter(item => item.category === "notes").length > 0 
                            ? Math.round(totalDownloads / content.filter(item => item.category === "notes").length * 10) / 10
                            : 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* User Management Tab (Super Admin Only) */}
            {isSuperAdmin && (
              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>User Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                        <CardContent className="pt-6">
                          <h3 className="text-lg font-semibold mb-4">Promote User to Admin</h3>
                          <div className="flex gap-4">
                            <div className="flex-1">
                              <Label className="sr-only">Select user</Label>
                              <Select value={selectedUser} onValueChange={(v) => setSelectedUser(v)}>
                                <SelectTrigger className="w-full">
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
                            </div>
                            <Button onClick={handlePromoteUser} disabled={!selectedUser} className="bg-orange-600 hover:bg-orange-700">
                              Promote to Admin
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Admins</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2 mb-4">
                            <Input placeholder="email@domain.com" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
                            <Button onClick={handleAddAdmin} disabled={addingAdmin}>
                              {addingAdmin ? 'Adding…' : 'Add Admin'}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {admins.length === 0 && <p className="text-sm text-muted-foreground">No admins configured.</p>}
                            {admins.map(a => (
                              <div key={`admin:${a.key}`} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                  <div className="font-medium">{a.email}</div>
                                  <div className="text-xs text-muted-foreground">{a.role}</div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveAdmin(a.key)}
                                  disabled={removingAdminKey === a.key}
                                >
                                  {removingAdminKey === a.key ? 'Removing…' : 'Remove'}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <div>
                        <h3 className="text-lg font-semibold mb-4">All Users</h3>
                        <div className="space-y-3">
                          {users.map((user, idx) => (
                            <div key={`${user.uid || user.email || idx}`} className="flex items-center justify-between p-4 border rounded-lg">
                              <div>
                                <h4 className="font-medium">{user.name}</h4>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                              <Badge variant={
                                user.role === "superadmin" ? "default" : 
                                user.role === "admin" ? "secondary" : "outline"
                              }>
                                {user.role}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}