import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, FileText, Video, AlertCircle, Star, Clock, Sparkles, X, UserPlus, UserMinus, Shield, Upload, Minus, FolderPlus, FolderMinus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { firebaseService } from "@/lib/firebaseAdmin";
import { useAuth } from "@/contexts/AuthContext";
import type { AppNotification } from "@shared/schema";

// Notification icon mapping with gradients
const notificationStyles: Record<AppNotification['type'], { icon: any; gradient: string; bgColor: string }> = {
  submission_pending: { 
    icon: Clock, 
    gradient: "from-amber-400 to-orange-500",
    bgColor: "bg-amber-100 dark:bg-amber-900/30"
  },
  submission_approved: { 
    icon: Check, 
    gradient: "from-green-400 to-emerald-500",
    bgColor: "bg-green-100 dark:bg-green-900/30"
  },
  submission_rejected: { 
    icon: X, 
    gradient: "from-red-400 to-rose-500",
    bgColor: "bg-red-100 dark:bg-red-900/30"
  },
  content_rated: { 
    icon: Star, 
    gradient: "from-yellow-400 to-amber-500",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30"
  },
  content_reported: { 
    icon: AlertCircle, 
    gradient: "from-orange-400 to-red-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30"
  },
  pending_approval: { 
    icon: FileText, 
    gradient: "from-blue-400 to-indigo-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30"
  },
  admin_added: { 
    icon: UserPlus, 
    gradient: "from-emerald-400 to-teal-500",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30"
  },
  admin_removed: { 
    icon: UserMinus, 
    gradient: "from-rose-400 to-pink-500",
    bgColor: "bg-rose-100 dark:bg-rose-900/30"
  },
  report_reviewed: { 
    icon: Shield, 
    gradient: "from-purple-400 to-violet-500",
    bgColor: "bg-purple-100 dark:bg-purple-900/30"
  },
  content_approved: { 
    icon: CheckCheck, 
    gradient: "from-teal-400 to-cyan-500",
    bgColor: "bg-teal-100 dark:bg-teal-900/30"
  },
  admin_content_added: { 
    icon: Upload, 
    gradient: "from-sky-400 to-blue-500",
    bgColor: "bg-sky-100 dark:bg-sky-900/30"
  },
  admin_content_deleted: { 
    icon: Minus, 
    gradient: "from-red-400 to-rose-500",
    bgColor: "bg-red-100 dark:bg-red-900/30"
  },
  admin_scheme_created: { 
    icon: Layers, 
    gradient: "from-indigo-400 to-purple-500",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30"
  },
  admin_subject_added: { 
    icon: FolderPlus, 
    gradient: "from-green-400 to-teal-500",
    bgColor: "bg-green-100 dark:bg-green-900/30"
  },
  admin_subject_deleted: { 
    icon: FolderMinus, 
    gradient: "from-orange-400 to-red-500",
    bgColor: "bg-orange-100 dark:bg-orange-900/30"
  },
  content_deleted: { 
    icon: Trash2, 
    gradient: "from-gray-400 to-slate-500",
    bgColor: "bg-gray-100 dark:bg-gray-900/30"
  },
};

export function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Set up real-time listener
    const unsubscribe = firebaseService.onNotificationsChange(user.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;
    try {
      await firebaseService.markNotificationAsRead(user.uid, notificationId);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid) return;
    try {
      await firebaseService.markAllNotificationsAsRead(user.uid);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.uid) return;
    try {
      await firebaseService.deleteNotification(user.uid, notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const getNotificationStyle = (type: AppNotification['type']) => {
    return notificationStyles[type] || notificationStyles.pending_approval;
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-9 w-9 hover:bg-primary/10"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75"></span>
              <Badge 
                variant="destructive" 
                className="relative h-5 min-w-5 flex items-center justify-center p-0 text-[10px] font-bold rounded-full bg-gradient-to-r from-red-500 to-rose-600 border-0"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-2rem)] sm:w-96 p-0 shadow-2xl border-0 bg-gradient-to-b from-card to-background rounded-xl overflow-hidden" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 border-b backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-[10px] text-muted-foreground">{unreadCount} unread</p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] gap-1 hover:bg-primary/10"
                onClick={handleMarkAllAsRead}
              >
                <CheckCheck className="h-3 w-3" />
                Mark all
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[350px] sm:h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
                You have no new notifications. Check back later!
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification, index) => {
                const style = getNotificationStyle(notification.type);
                const IconComponent = style.icon;
                
                return (
                  <div
                    key={notification.id}
                    className={`relative p-3 rounded-lg cursor-pointer group transition-all duration-200 hover:scale-[1.01] ${
                      !notification.read 
                        ? 'bg-gradient-to-r from-primary/5 to-transparent shadow-sm' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={(e) => !notification.read && handleMarkAsRead(notification.id, e)}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`h-10 w-10 rounded-full ${style.bgColor} flex items-center justify-center shrink-0 ring-2 ring-white dark:ring-gray-800`}>
                        <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-lg`}>
                          <IconComponent className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-tight ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-primary/60 shadow-sm shadow-primary/50" />
                            )}
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        
                        {notification.contentType && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full">
                              {notification.contentType === 'videos' ? (
                                <Video className="h-2.5 w-2.5" />
                              ) : (
                                <FileText className="h-2.5 w-2.5" />
                              )}
                              {notification.contentType}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={(e) => handleDelete(notification.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/30 backdrop-blur-sm">
            <p className="text-[10px] text-center text-muted-foreground">
              {notifications.length} notification{notifications.length !== 1 ? 's' : ''} • Last 50 shown
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationCenter;
