import { useState, useEffect } from "react";
import { Star, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { firebaseService } from "@/lib/firebaseAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { REPORT_REASON_LABELS, type ContentItem, type Report } from "@shared/schema";

interface ContentRatingProps {
  content: ContentItem;
  showRatingStars?: boolean;
}

// Star Rating Component
export function StarRating({ 
  rating, 
  onRate, 
  readonly = false,
  size = "default" 
}: { 
  rating: number; 
  onRate?: (rating: number) => void; 
  readonly?: boolean;
  size?: "small" | "default";
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const sizeClass = size === "small" ? "h-3 w-3" : "h-4 w-4";
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform disabled:opacity-100`}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
          onClick={() => onRate?.(star)}
        >
          <Star
            className={`${sizeClass} ${
              star <= (hoverRating || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/40'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// Content Rating Display with ability to rate
export function ContentRating({ content, showRatingStars = true }: ContentRatingProps) {
  const { user, isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const [averageRating, setAverageRating] = useState<{ average: number; count: number }>({ average: 0, count: 0 });
  const [userRating, setUserRating] = useState<number>(0);
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isLoginPromptOpen, setIsLoginPromptOpen] = useState(false);
  const [loginPromptAction, setLoginPromptAction] = useState<'rate' | 'report'>('rate');
  const [submitting, setSubmitting] = useState(false);
  const [reportReason, setReportReason] = useState<Report['reason'] | ''>('');
  const [reportDescription, setReportDescription] = useState('');
  const [hasReported, setHasReported] = useState(false);
  const [loadingRating, setLoadingRating] = useState(true);

  useEffect(() => {
    setLoadingRating(true);
    loadRatingData().finally(() => setLoadingRating(false));
  }, [content.id, user?.uid]);

  const loadRatingData = async () => {
    try {
      const avgRating = await firebaseService.getAverageRating(
        content.id,
        content.category as 'notes' | 'videos',
        content.semester,
        content.subjectId
      );
      setAverageRating(avgRating);

      if (user?.uid) {
        const existingRating = await firebaseService.getUserRatingForContent(
          user.uid,
          content.id,
          content.category as 'notes' | 'videos'
        );
        setUserRating(existingRating?.rating || 0);

        const reported = await firebaseService.hasUserReportedContent(user.uid, content.id);
        setHasReported(reported);
      }
    } catch (error) {
      console.error('Error loading rating data:', error);
    }
  };

  const handleRate = async (rating: number) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to rate content.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await firebaseService.createOrUpdateRating({
        contentId: content.id,
        contentType: content.category as 'notes' | 'videos',
        semester: content.semester,
        subjectId: content.subjectId,
        userId: user.uid,
        userName: user.name || user.email,
        rating,
      });

      setUserRating(rating);
      await loadRatingData();
      
      toast({
        title: "Rating submitted",
        description: `You rated this ${content.category === 'notes' ? 'note' : 'video'} ${rating} star${rating > 1 ? 's' : ''}.`,
      });
      setIsRatingDialogOpen(false);
    } catch (error) {
      console.error('Error rating content:', error);
      toast({
        title: "Rating failed",
        description: "Failed to submit your rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to report content.",
        variant: "destructive",
      });
      return;
    }

    if (!reportReason) {
      toast({
        title: "Reason required",
        description: "Please select a reason for your report.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await firebaseService.createReport({
        contentId: content.id,
        contentType: content.category as 'notes' | 'videos',
        semester: content.semester,
        subjectId: content.subjectId,
        contentTitle: content.title,
        contentUploadedBy: content.uploadedBy,
        reportedBy: user.uid,
        reporterName: user.name,
        reporterEmail: user.email,
        reason: reportReason as Report['reason'],
        description: reportDescription,
      });

      setHasReported(true);
      toast({
        title: "Report submitted",
        description: "Thank you for your report. Our team will review it shortly.",
      });
      setIsReportDialogOpen(false);
      setReportReason('');
      setReportDescription('');
    } catch (error) {
      console.error('Error reporting content:', error);
      toast({
        title: "Report failed",
        description: "Failed to submit your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Rating display */}
      {showRatingStars && (
        <div className="flex items-center gap-1.5">
          {loadingRating ? (
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-3 w-3 rounded-sm bg-muted animate-pulse" />
              ))}
              <span className="ml-1 h-3 w-8 rounded bg-muted animate-pulse" />
            </div>
          ) : (
            <>
              <StarRating rating={Math.round(averageRating.average)} readonly size="small" />
              <span className="text-xs text-muted-foreground">
                {averageRating.count > 0 
                  ? `${averageRating.average.toFixed(1)} (${averageRating.count})`
                  : 'No ratings'
                }
              </span>
            </>
          )}
        </div>
      )}

      {/* Login Prompt Dialog */}
      <Dialog open={isLoginPromptOpen} onOpenChange={setIsLoginPromptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {loginPromptAction === 'rate' ? (
                <><Star className="h-5 w-5 text-yellow-500" /> Sign in to Rate</>
              ) : (
                <><Flag className="h-5 w-5 text-destructive" /> Sign in to Report</>
              )}
            </DialogTitle>
            <DialogDescription>
              You need to sign in with your Google account to {loginPromptAction === 'rate' ? 'rate content' : 'report issues'}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button onClick={() => { login(); setIsLoginPromptOpen(false); }} className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>
            <Button variant="outline" onClick={() => setIsLoginPromptOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rate button */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                setLoginPromptAction('rate');
                setIsLoginPromptOpen(true);
              }
            }}
            title={!isAuthenticated ? 'Sign in to rate' : 'Rate this content'}
          >
            <Star className={`h-3 w-3 ${userRating > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            <span className="hidden sm:inline">{userRating > 0 ? 'Rated' : 'Rate'}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate this {content.category === 'notes' ? 'Note' : 'Video'}</DialogTitle>
            <DialogDescription>
              "{content.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-muted-foreground">How would you rate this content?</p>
            <StarRating rating={userRating} onRate={handleRate} />
            <p className="text-xs text-muted-foreground">
              Click a star to rate
            </p>
          </div>
          {submitting && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report button */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
            disabled={hasReported}
            onClick={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                setLoginPromptAction('report');
                setIsLoginPromptOpen(true);
              }
            }}
            title={
              !isAuthenticated 
                ? 'Sign in to report' 
                : hasReported 
                  ? 'You already reported this content'
                  : 'Report this content'
            }
          >
            <Flag className={`h-3 w-3 ${hasReported ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{hasReported ? 'Reported' : 'Report'}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
            <DialogDescription>
              Report "{content.title}" for inappropriate or problematic content.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Reason for report *</Label>
              <Select value={reportReason} onValueChange={(v) => setReportReason(v as Report['reason'])}>
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_REASON_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Additional details (optional)</Label>
              <Textarea
                id="description"
                placeholder="Provide more context about the issue..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsReportDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReport}
              disabled={submitting || !reportReason}
              variant="destructive"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ContentRating;
