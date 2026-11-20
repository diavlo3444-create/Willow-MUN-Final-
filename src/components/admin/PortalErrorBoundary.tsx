import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, LogOut, RefreshCw, RotateCcw } from 'lucide-react';

interface PortalErrorBoundaryProps {
  children: ReactNode;
  onNavigate?: (path: string) => void;
  onSignOut?: () => void;
  resetKey?: string;
}

interface PortalErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class PortalErrorBoundary extends Component<
  PortalErrorBoundaryProps,
  PortalErrorBoundaryState
> {
  state: PortalErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): PortalErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected interface error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Willow MUN portal render error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: PortalErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleReturnToLogin = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onNavigate) {
      this.props.onNavigate('/portal');
    } else if (typeof window !== 'undefined') {
      window.location.assign('/portal');
    }
  };

  private handleSignOut = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onSignOut) {
      this.props.onSignOut();
    }
    if (this.props.onNavigate) {
      this.props.onNavigate('/portal');
    } else if (typeof window !== 'undefined') {
      window.location.assign('/portal');
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="wm-admin min-h-[100dvh] grid place-items-center bg-[color:var(--wm-canvas)] p-6 text-[color:var(--wm-ink)]">
        <section
          role="alert"
          className="wm-surface-panel w-full max-w-md border-rose-400/35 p-6 text-center shadow-2xl"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/10">
            <AlertTriangle className="h-6 w-6 text-rose-300" aria-hidden="true" />
          </div>
          <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.2em] text-rose-300">
            Portal Recovery
          </p>
          <h1 className="wm-serif mt-2 text-2xl font-semibold text-[color:var(--wm-ink)]">
            This portal view encountered an error
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--wm-ink-secondary)]">
            {this.state.errorMessage}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[color:var(--wm-emerald)] px-4 text-xs font-semibold text-[#eef4ef] hover:bg-[#357a5b]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReturnToLogin}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline-strong)] bg-[color:var(--wm-inset)] px-3.5 text-xs text-[color:var(--wm-ink)] hover:bg-[color:var(--wm-overlay)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Return to sign in
            </button>
            <button
              type="button"
              onClick={this.handleSignOut}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[color:var(--wm-hairline)] px-3.5 text-xs text-[color:var(--wm-ink-secondary)] hover:border-rose-400/40 hover:text-rose-200"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </section>
      </div>
    );
  }
}
