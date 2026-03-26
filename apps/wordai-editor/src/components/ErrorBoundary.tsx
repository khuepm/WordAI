import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" data-testid="error-boundary-fallback" style={{
          padding: '2rem', fontFamily: 'var(--font-family-ui)',
          color: 'var(--md-sys-color-error)'
        }}>
          <p>Something went wrong. Please reload the app.</p>
          <pre style={{ fontSize: '0.75rem', opacity: 0.7 }}>{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
