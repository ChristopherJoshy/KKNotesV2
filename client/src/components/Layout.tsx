import { Header } from "./Header";

interface LayoutProps {
  children: React.ReactNode;
  onAdminToggle?: () => void;
  showAdminPanel?: boolean;
}

export function Layout({ children, onAdminToggle, showAdminPanel }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header onAdminToggle={onAdminToggle} showAdminPanel={showAdminPanel} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
