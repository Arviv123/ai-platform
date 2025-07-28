'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // קריאה ל-callback אם סופק
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // שליחת השגיאה לשירות ניטור (אופציונלי)
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // כאן אפשר לשלוח לשירות ניטור כמו Sentry
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      // שליחה לשרת (אופציונלי)
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData)
      }).catch(console.error);
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      // אם סופק fallback component
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h1 className="text-xl font-semibold text-gray-900 text-center mb-2">
              אירעה שגיאה בלתי צפויה
            </h1>
            
            <p className="text-gray-600 text-center mb-6">
              משהו השתבש. אנא נסה שוב או רענן את הדף.
            </p>

            {/* הצגת פרטי השגיאה במצב פיתוח */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 p-3 bg-gray-100 rounded border text-sm">
                <summary className="cursor-pointer font-medium text-gray-700">
                  פרטי השגיאה (מצב פיתוח)
                </summary>
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium">שגיאה:</p>
                  <pre className="whitespace-pre-wrap bg-red-50 p-2 rounded text-red-800 mb-2">
                    {this.state.error.message}
                  </pre>
                  {this.state.error.stack && (
                    <>
                      <p className="font-medium">Stack trace:</p>
                      <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded text-gray-700 text-xs">
                        {this.state.error.stack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                נסה שוב
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                רענן דף
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                אם הבעיה נמשכת, אנא צור קשר עם התמיכה
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;