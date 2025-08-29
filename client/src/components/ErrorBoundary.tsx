import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary component to catch and handle React component errors
 * Prevents application crashes by providing fallback UI for error states
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Update state when an error occurs in child components
   * @param error - The error that occurred
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Handle component errors and log detailed information
   * @param error - The error that occurred
   * @param errorInfo - Additional error information from React
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  /**
   * Reset error state to retry rendering
   */
  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  /**
   * Reload the page as fallback recovery method
   */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full mx-4">
            <div className="bg-card border rounded-lg p-6 text-center">
              <div className="mb-4">
                <i className="fas fa-exclamation-triangle text-4xl text-destructive"></i>
              </div>
              <h2 className="text-xl font-semibold text-card-foreground mb-2">
                Something went wrong
              </h2>
              <p className="text-muted-foreground mb-6">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              <div className="space-y-2">
                <button
                  onClick={this.handleReset}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 px-4 py-2 rounded-md transition-colors"
                >
                  Refresh Page
                </button>
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs text-destructive bg-destructive/10 p-2 rounded overflow-auto">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}