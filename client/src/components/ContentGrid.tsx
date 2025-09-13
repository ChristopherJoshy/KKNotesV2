import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { firebaseService } from "@/lib/firebaseAdmin";
import { Note, Video, Subject, ContentItem } from "@shared/schema";
import { toast } from "@/hooks/use-toast";

interface ContentGridProps {
  semester: string;
  subjectId: string;
  subject: Subject;
  selectedCategory: "all" | "notes" | "videos";
}

export function ContentGrid({ semester, subjectId, subject, selectedCategory }: ContentGridProps) {
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
      });
    };

    loadContent();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [semester, subjectId, selectedCategory]);

  const handleContentClick = async (item: ContentItem) => {
    try {
      if (item.category === "notes") {
        // Increment download counter for notes
        await firebaseService.incrementDownload({ id: item.id, semester: item.semester, subjectId: item.subjectId });
        window.open(item.url, '_blank');
        toast({
          title: "Note Downloaded",
          description: `Opening "${item.title}"`,
        });
      } else {
        // Increment view counter for videos
        await firebaseService.incrementView({ id: item.id, semester: item.semester, subjectId: item.subjectId });
        if (item.url.includes('youtube.com') || item.url.includes('youtu.be')) {
          window.open(item.url, '_blank');
        } else {
          window.open(item.url, '_blank');
        }
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading content...</span>
      </div>
    );
  }

  const filteredContent = selectedCategory === "all" 
    ? content 
    : content.filter(item => item.category === selectedCategory);

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-foreground">Available Content</h3>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <i className="fas fa-info-circle"></i>
          <span>Click to access</span>
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

      {/* Content Grid */}
      {filteredContent.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContent.map((item) => (
            <Card
              key={item.id}
              data-testid={`card-${item.category}-${item.id}`}
              className="shadow-sm card-hover cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-1"
              onClick={() => handleContentClick(item)}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    item.category === "notes" ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/20"
                  }`}>
                    <i className={`${getIcon(item.category)} text-xl ${
                      item.category === "notes" ? "text-primary" : "text-red-600 dark:text-red-400"
                    }`}></i>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {getFileType(item.category)}
                  </Badge>
                </div>
                <h5 data-testid={`text-${item.category}-title-${item.id}`} className="text-lg font-semibold text-card-foreground mb-2">
                  {item.title}
                </h5>
                {item.description && (
                  <p data-testid={`text-${item.category}-description-${item.id}`} className="text-sm text-muted-foreground mb-4">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span data-testid={`text-${item.category}-timestamp-${item.id}`}>
                    {formatTimestamp(item.timestamp)}
                  </span>
                  <span className="flex items-center space-x-1">
                    <i className={item.category === "notes" ? "fas fa-download" : "fas fa-eye"}></i>
                    <span data-testid={`text-${item.category}-stats-${item.id}`}>
                      {getStats(item)}
                    </span>
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div data-testid="empty-state-content" className="text-center py-12">
          <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-file-alt text-muted-foreground text-3xl"></i>
          </div>
          <h4 className="text-lg font-semibold text-foreground mb-2">No Content Available</h4>
          <p className="text-muted-foreground">
            There are no {selectedCategory === "all" ? "materials" : selectedCategory} uploaded for this subject yet. Check back later!
          </p>
        </div>
      )}
    </div>
  );
}