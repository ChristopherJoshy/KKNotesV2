import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { firebaseService } from "@/lib/firebaseAdmin";
import { Note, Subject } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

interface NotesGridProps {
  semester: string;
  subjectId: string;
  subject: Subject;
}

export function NotesGrid({ semester, subjectId, subject }: NotesGridProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const loadNotes = () => {
      setLoading(true);
      
      // Set up real-time listener
      unsubscribe = firebaseService.onNotesChange(semester, subjectId, (updatedNotes) => {
        setNotes(updatedNotes);
        setLoading(false);
      });
    };

    loadNotes();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [semester, subjectId]);

  const handleNoteClick = async (note: Note) => {
    try {
      // Increment download counter
      await firebaseService.incrementDownload({ id: note.id, semester, subjectId });
      
      // Open note in new tab
      window.open(note.url, '_blank');
      
      toast({
        title: "Note Downloaded",
        description: `Opening "${note.title}"`,
      });
    } catch (error) {
      console.error('Error downloading note:', error);
      toast({
        title: "Download Error",
        description: "Failed to download the note. Please try again.",
        variant: "destructive"
      });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading notes...</span>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-foreground">Available Notes</h3>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <i className="fas fa-info-circle"></i>
          <span>Click to download</span>
        </div>
      </div>

      {/* Subject Info Card */}
      <Card className="mb-6 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div>
              <h4 data-testid="text-subject-name" className="text-lg font-semibold text-card-foreground mb-1">
                {subject.name}
              </h4>
              <p className="text-muted-foreground text-sm">
                {`Semester ${semester.replace('s','').toUpperCase()}`} • Computer Science Engineering
              </p>
            </div>
            <div className="mt-4 sm:mt-0" />
          </div>
        </CardContent>
      </Card>

      {/* Notes Grid */}
      {notes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <Card
              key={note.id}
              data-testid={`card-note-${note.id}`}
              className="shadow-sm card-hover cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1"
              onClick={() => handleNoteClick(note)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-file-pdf text-primary text-xl"></i>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    PDF
                  </Badge>
                </div>
                <h5 data-testid={`text-note-title-${note.id}`} className="text-lg font-semibold text-card-foreground mb-2">
                  {note.title}
                </h5>
                {note.description && (
                  <p data-testid={`text-note-description-${note.id}`} className="text-sm text-muted-foreground mb-4">
                    {note.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span data-testid={`text-note-timestamp-${note.id}`}>
                    {formatTimestamp(note.timestamp)}
                  </span>
                  <span className="flex items-center space-x-1">
                    <i className="fas fa-download"></i>
                    <span data-testid={`text-note-downloads-${note.id}`}>
                      {note.downloads || 0} downloads
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div data-testid="empty-state-notes" className="text-center py-12">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-file-alt text-muted-foreground text-3xl"></i>
          </div>
          <h4 className="text-lg font-semibold text-foreground mb-2">No Notes Available</h4>
          <p className="text-muted-foreground">There are no notes uploaded for this subject yet. Check back later!</p>
        </div>
      )}
    </div>
  );
}
