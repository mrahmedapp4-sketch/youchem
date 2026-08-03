import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            padding: '2rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '2rem',
              maxWidth: 480,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ color: '#0f172a', fontWeight: 700, marginBottom: 8 }}>
              في مشكلة في التطبيق
            </h2>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
              حصل خطأ غير متوقع. ممكن تجرب تعمل refresh للصفحة.
            </p>
            <pre
              style={{
                background: '#f1f5f9',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: 12,
                color: '#ef4444',
                textAlign: 'left',
                direction: 'ltr',
                overflow: 'auto',
                maxHeight: 120,
                marginBottom: 16,
              }}
            >
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.6rem 1.5rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
