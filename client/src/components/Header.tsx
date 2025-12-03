import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { SubmitContent } from "./SubmitContent";
import { NotificationCenter } from "./NotificationCenter";

interface HeaderProps {
  onAdminToggle?: () => void;
  showAdminPanel?: boolean;
}

export function Header({ onAdminToggle, showAdminPanel }: HeaderProps) {
  const { user, isAuthenticated, isAdmin, login, logout, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <i className="fas fa-graduation-cap text-primary-foreground text-sm sm:text-lg"></i>
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-foreground truncate">KKNotes</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Student Notes Portal</p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Submit Content Button - visible to all */}
            <SubmitContent />
            
            {/* Notification Center - visible when logged in */}
            {isAuthenticated && <NotificationCenter />}
            
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
              </div>
            ) : !isAuthenticated ? (
              <Button
                data-testid="button-login"
                onClick={login}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
              >
                <i className="fab fa-google text-xs sm:text-sm"></i>
                <span className="hidden sm:inline">Sign In</span>
                <span className="sm:hidden">Login</span>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2">
                    <Avatar className="w-8 h-8 sm:w-9 sm:h-9 border-2 border-primary/20">
                      <AvatarImage src={user?.photoURL} alt={user?.name} />
                      <AvatarFallback data-testid="text-user-initials" className="bg-primary/10 text-primary text-xs sm:text-sm font-medium">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span data-testid="text-username" className="hidden md:inline text-sm font-medium max-w-[100px] truncate">
                      {user?.name}
                    </span>
                    <i className="fas fa-chevron-down text-xs text-muted-foreground hidden md:block"></i>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user?.photoURL} alt={user?.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="truncate flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{user?.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && onAdminToggle && (
                    <DropdownMenuItem onClick={onAdminToggle} className="cursor-pointer gap-2">
                      <i className="fas fa-user-shield w-4 text-center"></i>
                      {showAdminPanel ? 'Back to Notes' : 'Admin Panel'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={logout} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                    <i className="fas fa-sign-out-alt w-4 text-center"></i>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
