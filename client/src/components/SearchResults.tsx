import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentItem, Note, Video } from "@shared/schema";
import { firebaseService } from "@/lib/firebaseAdmin";
import { toast } from "@/hooks/use-toast";
import { ContentRating } from "./ContentRating";

interface SearchResultsProps {
  results: ContentItem[];
  searchQuery: string;
  loading: boolean;
  onLoadMore?: () => void;
  hasMoreResults?: boolean;
}

/**
 * Display component for search results with highlighting and interaction
 * Shows search results in a grid format with content previews
 */
export function SearchResults({ 
  results, 
  searchQuery, 
  loading, 
  onLoadMore, 
  hasMoreResults = false 
}: SearchResultsProps) {

  /**
   * Handle content item click with analytics tracking
   */
  const handleContentClick = async (item: ContentItem) => {
    try {
      if (item.category === "notes") {
        await firebaseService.incrementDownload({ id: item.id, semester: item.semester, subjectId: item.subjectId });
        window.open(item.url, '_blank');
        toast({
          title: "Note Opened",
          description: `Opening "${item.title}"`,
        });
      } else {
        await firebaseService.incrementView({ id: item.id, semester: item.semester, subjectId: item.subjectId });
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

  /**
   * Highlight search terms in text
   */
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const terms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    let highlightedText = text;
    
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>');
    });
    
    return highlightedText;
  };

  /**
   * Format content statistics
   */
  const getContentStats = (item: ContentItem) => {
    if (item.category === "notes") {
      const downloads = (item as Note).downloads || 0;
      return `${downloads} download${downloads !== 1 ? 's' : ''}`;
    } else {
      const views = (item as Video).views || 0;
      return `${views} view${views !== 1 ? 's' : ''}`;
    }
  };

  /**
   * Format timestamp for display
   */
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

  /**
   * Get content type icon
   */
  const getContentIcon = (category: string) => {
    return category === "notes" ? "fas fa-file-pdf" : "fas fa-play-circle";
  };

  /**
   * Get content type color
   */
  const getContentColor = (category: string) => {
    return category === "notes" ? "text-primary" : "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        {[...Array(6)].map((_, index) => (
          <Card key={index} className="shadow-sm border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-muted rounded-lg shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 sm:h-5 bg-muted rounded w-3/4"></div>
                  <div className="h-3 sm:h-4 bg-muted rounded w-full"></div>
                  <div className="h-3 sm:h-4 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Card data-testid="empty-state-search" className="text-center py-8 sm:py-12 border-border">
        <CardContent className="p-4 sm:p-6">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-search text-muted-foreground text-xl sm:text-3xl"></i>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">No Results Found</h3>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            {searchQuery 
              ? `No content found matching "${searchQuery}". Try different keywords or adjust your filters.`
              : "Try searching for notes, videos, or topics you're interested in."
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {results.map((item) => (
        <Card
          key={item.id}
          data-testid={`search-result-${item.id}`}
          className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border-border"
          onClick={() => handleContentClick(item)}
        >
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Content Type Icon */}
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center shrink-0 ${
                item.category === "notes" ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/20"
              }`}>
                <i className={`${getContentIcon(item.category)} text-lg sm:text-xl ${getContentColor(item.category)}`}></i>
              </div>

              {/* Content Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 
                    data-testid={`result-title-${item.id}`}
                    className="text-sm sm:text-lg font-semibold text-card-foreground line-clamp-2"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightText(item.title, searchQuery) 
                    }}
                  />
                  <Badge 
                    variant={item.category === "notes" ? "default" : "destructive"} 
                    className="shrink-0 text-[10px] sm:text-xs"
                  >
                    {item.category === "notes" ? "NOTE" : "VIDEO"}
                  </Badge>
                </div>

                {item.description && (
                  <p 
                    data-testid={`result-description-${item.id}`}
                    className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2 sm:mb-3"
                    dangerouslySetInnerHTML={{ 
                      __html: highlightText(item.description, searchQuery) 
                    }}
                  />
                )}

                {/* Subject and Metadata */}
                <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                  {(item as any).subjectName && (
                    <span className="flex items-center">
                      <i className="fas fa-book mr-1 text-[10px] sm:text-xs"></i>
                      <span data-testid={`result-subject-${item.id}`} className="truncate max-w-[120px] sm:max-w-none">
                        {(item as any).subjectName}
                      </span>
                    </span>
                  )}
                  <span className="flex items-center">
                    <i className={`${item.category === "notes" ? "fas fa-download" : "fas fa-eye"} mr-1 text-[10px] sm:text-xs`}></i>
                    <span data-testid={`result-stats-${item.id}`}>
                      {getContentStats(item)}
                    </span>
                  </span>
                  <span data-testid={`result-timestamp-${item.id}`} className="ml-auto">
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>

                {/* Rating and Report */}
                <div className="mt-3 pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  <ContentRating content={item} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Load More Button */}
      {hasMoreResults && onLoadMore && (
        <div className="text-center py-4 sm:py-6">
          <Button 
            data-testid="button-load-more"
            onClick={onLoadMore}
            variant="outline"
            size="sm"
            className="text-sm"
          >
            <i className="fas fa-plus mr-2"></i>
            Load More Results
          </Button>
        </div>
      )}
    </div>
  );
}