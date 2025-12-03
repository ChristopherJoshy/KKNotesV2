import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { firebaseService } from "@/lib/firebaseAdmin";
import { Note, Video, Subject, ContentItem } from "@shared/schema";
import { toast } from "@/hooks/use-toast";
import { ContentRating } from "./ContentRating";

interface ContentGridProps {
  semester: string;
  subjectId: string;
  subject: Subject;
  selectedCategory: "all" | "notes" | "videos";
  scheme?: string;
}

export function ContentGrid({ semester, subjectId, subject, selectedCategory, scheme = "2019" }: ContentGridProps) {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const loadContent = () => {
      setLoading(true);
      
      // Set up real-time listener for both notes and videos
      unsubscribe = firebaseService.onContentChange(semester, subjectId, selectedCategory, (updatedContent) => {
        setContent(updatedContent);
        setLoading(false);
      }, scheme);
    };

    loadContent();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [semester, subjectId, selectedCategory, scheme]);

  const handleContentClick = async (item: ContentItem) => {
    try {
      if (item.category === "notes") {
        // Increment download counter for notes
        await firebaseService.incrementDownload({ id: item.id, semester: item.semester, subjectId: item.subjectId }, scheme);
        window.open(item.url, '_blank');
        toast({
          title: "Note Downloaded",
          description: `Opening "${item.title}"`,
        });
      } else {
        // Increment view counter for videos
        await firebaseService.incrementView({ id: item.id, semester: item.semester, subjectId: item.subjectId }, scheme);
        window.open(item.url, '_blank');
        toast({
          title: "Video Opened",
          description: `Opening "${item.title}"`,
        });
      }
    } catch (error) {
      console.error('Error accessing content:', error);
      toast({
        title: "Access Error",
        description: "Failed to access the content. Please try again.",
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

  const getIcon = (category: string) => {
    return category === "notes" ? "fas fa-file-pdf" : "fas fa-play-circle";
  };

  const getFileType = (category: string) => {
    return category === "notes" ? "PDF" : "VIDEO";
  };

  const getStats = (item: ContentItem) => {
    if (item.category === "notes") {
      return `${(item as Note).downloads || 0} downloads`;
    } else {
      return `${(item as Video).views || 0} views`;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 sm:py-12">
        <div className="h-6 w-6 sm:h-8 sm:w-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-sm sm:text-base text-muted-foreground">Loading content...</span>
      </div>
    );
  }

  const filteredContent = selectedCategory === "all" 
    ? content 
    : content.filter(item => item.category === selectedCategory);

  return (
    <div className="fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Available Content</h3>
        <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
          <i className="fas fa-info-circle"></i>
          <span>Click to access</span>
        </div>
      </div>

      {/* Subject Info Card */}
      <Card className="mb-4 sm:mb-6 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 data-testid="text-subject-name" className="text-base sm:text-lg font-semibold text-card-foreground mb-1">
                {subject.name}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {`Semester ${semester.replace('s','').toUpperCase()}`} • Computer Science Engineering
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Grid */}
      {filteredContent.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {filteredContent.map((item) => (
            <Card
              key={item.id}
              data-testid={`card-${item.category}-${item.id}`}
              className="shadow-sm card-hover cursor-pointer border-border hover:border-primary/30"
              onClick={() => handleContentClick(item)}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shrink-0 ${
                    item.category === "notes" ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/20"
                  }`}>
                    <i className={`${getIcon(item.category)} text-base sm:text-xl ${
                      item.category === "notes" ? "text-primary" : "text-red-600 dark:text-red-400"
                    }`}></i>
                  </div>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
                    {getFileType(item.category)}
                  </Badge>
                </div>
                <h5 data-testid={`text-${item.category}-title-${item.id}`} className="text-sm sm:text-base lg:text-lg font-semibold text-card-foreground mb-1 sm:mb-2 line-clamp-2">
                  {item.title}
                </h5>
                {item.description && (
                  <p data-testid={`text-${item.category}-description-${item.id}`} className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <span data-testid={`text-${item.category}-timestamp-${item.id}`}>
                    {formatTimestamp(item.timestamp)}
                  </span>
                  <span className="flex items-center gap-1">
                    <i className={item.category === "notes" ? "fas fa-download" : "fas fa-eye"}></i>
                    <span data-testid={`text-${item.category}-stats-${item.id}`}>
                      {getStats(item)}
                    </span>
                  </span>
                </div>
                {/* Rating and Report */}
                <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <ContentRating content={item} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card data-testid="empty-state-content" className="text-center py-8 sm:py-12 border-dashed">
          <CardContent>
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <i className="fas fa-file-alt text-muted-foreground text-xl sm:text-2xl"></i>
            </div>
            <h4 className="text-base sm:text-lg font-semibold text-foreground mb-2">No Content Available</h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              There are no {selectedCategory === "all" ? "materials" : selectedCategory} uploaded for this subject yet. Check back later!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}