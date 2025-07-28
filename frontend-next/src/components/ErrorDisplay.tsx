'use client';

import React from 'react';
import { useError, AppError } from '../contexts/ErrorContext';

// אייקונים עבור סוגי שגיאות שונים
const ErrorIcon: React.FC<{ type: AppError['type']; severity: AppError['severity'] }> = ({ type, severity }) => {
  const getIconColor = () => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const iconClass = `w-5 h-5 ${getIconColor()}`;

  switch (type) {
    case 'api':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'network':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      );
    case 'auth':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case 'permission':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      );
    case 'validation':
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

// רכיב להצגת שגיאה בודדת
const ErrorItem: React.FC<{ error: AppError; onDismiss: () => void }> = ({ error, onDismiss }) => {
  const getBorderColor = () => {
    switch (error.severity) {
      case 'critical': return 'border-red-500';
      case 'high': return 'border-red-400';
      case 'medium': return 'border-yellow-400';
      case 'low': return 'border-blue-400';
      default: return 'border-gray-400';
    }
  };

  const getBackgroundColor = () => {
    switch (error.severity) {
      case 'critical': return 'bg-red-50';
      case 'high': return 'bg-red-50';
      case 'medium': return 'bg-yellow-50';
      case 'low': return 'bg-blue-50';
      default: return 'bg-gray-50';
    }
  };

  return (
    <div className={`border-l-4 ${getBorderColor()} ${getBackgroundColor()} p-4 mb-3 rounded-r-md shadow-sm`}>
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-3 rtl:space-x-reverse">
          <ErrorIcon type={error.type} severity={error.severity} />
          <div className="flex-1">
            <div className="flex items-center space-x-2 rtl:space-x-reverse mb-1">
              <h4 className="font-medium text-gray-900">{error.message}</h4>
              {error.source && (
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                  {error.source}
                </span>
              )}
            </div>
            
            {/* הצגת פרטים נוספים */}
            {error.details && process.env.NODE_ENV === 'development' && (
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">פרטים נוספים</summary>
                <pre className="text-xs text-gray-600 mt-1 bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </details>
            )}
            
            {/* כפתורי פעולה */}
            <div className="flex items-center space-x-2 rtl:space-x-reverse mt-2">
              {error.retry && (
                <button
                  onClick={() => {
                    error.retry!();
                    onDismiss();
                  }}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                >
                  נסה שוב
                </button>
              )}
              <span className="text-xs text-gray-400">
                {error.timestamp.toLocaleTimeString('he-IL')}
              </span>
            </div>
          </div>
        </div>
        
        {/* כפתור סגירה */}
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="סגור שגיאה"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// רכיב ראשי להצגת כל השגיאות
const ErrorDisplay: React.FC = () => {
  const { state, removeError, clearErrors } = useError();
  const { errors } = state;

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-50">
      <div className="space-y-2">
        {/* כפתור ניקוי כל השגיאות */}
        {errors.length > 1 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={clearErrors}
              className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              נקה הכל ({errors.length})
            </button>
          </div>
        )}
        
        {/* רשימת השגיאות */}
        {errors.map((error) => (
          <ErrorItem
            key={error.id}
            error={error}
            onDismiss={() => removeError(error.id)}
          />
        ))}
      </div>
    </div>
  );
};

// רכיב מעגל טעינה לשגיאות
export const ErrorLoadingSpinner: React.FC = () => {
  const { state } = useError();
  
  if (!state.isLoading) {
    return null;
  }
  
  return (
    <div className="fixed top-4 left-4 z-50">
      <div className="bg-white p-3 rounded-lg shadow-lg border">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">מעבד...</span>
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;