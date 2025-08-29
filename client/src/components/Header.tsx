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

interface HeaderProps {
  onAdminToggle?: () => void;
  showAdminPanel?: boolean;
}

export function Header({ onAdminToggle, showAdminPanel }: HeaderProps) {
  const { user, isAuthenticated, isAdmin, login, logout, loading } = useAuth();

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <i className="fas fa-graduation-cap text-primary-foreground text-lg"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">KKNotes V2</h1>
              <p className="text-xs text-muted-foreground">Student Notes Portal</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {loading && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
                <span className="hidden sm:inline text-sm text-muted-foreground">Signing in…</span>
              </div>
            )}
            {/* Admin quick button removed; keep dropdown entry only */}

            {!loading && (
              !isAuthenticated ? (
                <Button
                  data-testid="button-login"
                  onClick={login}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center space-x-2"
                >
                  <i className="fab fa-google"></i>
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={user?.photoURL} alt={user?.name} />
                        <AvatarFallback data-testid="text-user-initials">
                          {user?.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span data-testid="text-username" className="hidden sm:inline text-sm font-medium">
                        {user?.name}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={user?.photoURL} alt={user?.name} />
                        <AvatarFallback>
                          {user?.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="truncate">
                        <div className="text-sm font-medium truncate">{user?.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isAdmin && onAdminToggle && (
                      <DropdownMenuItem onClick={onAdminToggle} className="cursor-pointer">
                        <i className="fas fa-user-shield"></i>
                        {showAdminPanel ? 'Back to Notes' : 'Open Admin Panel'}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={logout} className="cursor-pointer">
                      <i className="fas fa-sign-out-alt"></i>
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
