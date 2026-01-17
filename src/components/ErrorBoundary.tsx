import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Component stack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 bg-red-50 rounded-lg border border-red-200 text-center">
          <h2 className="text-xl font-bold text-red-700 mb-2">حدث خطأ أثناء تحميل المكون</h2>
          <p className="text-red-600 mb-4">يرجى تحديث الصفحة أو الاتصال بالدعم الفني</p>
          <details className="text-left text-sm text-gray-700 bg-white p-3 rounded-lg">
            <summary className="cursor-pointer font-medium">تفاصيل الخطأ</summary>
            <p className="mt-2 font-mono">{this.state.error?.toString()}</p>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;