import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { firebaseService } from "@/lib/firebaseAdmin";
import { Note, Subject } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { ContentRating } from "./ContentRating";

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
      await firebaseService.incrementDownload({ id: note.id, semester, subjectId });
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
      <div className="flex items-center justify-center py-8 sm:py-12">
        <div className="h-6 w-6 sm:h-8 sm:w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-sm sm:text-base text-muted-foreground">Loading notes...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-2xl font-bold text-foreground">Available Notes</h3>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
          <i className="fas fa-info-circle"></i>
          <span>Click to download</span>
        </div>
      </div>

      {/* Subject Info Card */}
      <Card className="mb-4 sm:mb-6 shadow-sm border-border">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 data-testid="text-subject-name" className="text-base sm:text-lg font-semibold text-card-foreground mb-1">
                {subject.name}
              </h4>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {`Semester ${semester.replace('s','').toUpperCase()}`} • Computer Science Engineering
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes Grid */}
      {notes.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {notes.map((note) => (
            <Card
              key={note.id}
              data-testid={`card-note-${note.id}`}
              className="shadow-sm cursor-pointer hover:shadow-md border-border"
              onClick={() => handleNoteClick(note)}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <i className="fas fa-file-pdf text-primary text-base sm:text-xl"></i>
                  </div>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
                    PDF
                  </Badge>
                </div>
                <h5 data-testid={`text-note-title-${note.id}`} className="text-sm sm:text-lg font-semibold text-card-foreground mb-2 line-clamp-2">
                  {note.title}
                </h5>
                {note.description && (
                  <p data-testid={`text-note-description-${note.id}`} className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
                    {note.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground gap-2">
                  <span data-testid={`text-note-timestamp-${note.id}`} className="truncate">
                    {formatTimestamp(note.timestamp)}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <i className="fas fa-download"></i>
                    <span data-testid={`text-note-downloads-${note.id}`}>
                      {note.downloads || 0}
                    </span>
                  </span>
                </div>
                {/* Rating and Report */}
                <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <ContentRating content={note} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div data-testid="empty-state-notes" className="text-center py-8 sm:py-12">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-file-alt text-muted-foreground text-xl sm:text-3xl"></i>
          </div>
          <h4 className="text-base sm:text-lg font-semibold text-foreground mb-2">No Notes Available</h4>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            There are no notes uploaded for this subject yet. Check back later!
          </p>
        </div>
      )}
    </div>
  );
}
