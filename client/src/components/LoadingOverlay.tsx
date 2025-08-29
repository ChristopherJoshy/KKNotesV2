import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className={cn(
      "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-200",
      visible ? "opacity-100 visible" : "opacity-0 invisible"
    )}>
      <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span data-testid="text-loading-message" className="text-card-foreground">{message}</span>
        </div>
      </div>
    </div>
  );
}
