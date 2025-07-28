'use client';

import { useCallback } from 'react';
import { useError, AppError } from '../contexts/ErrorContext';

interface UseErrorHandlerReturn {
  handleError: (error: any, context?: string) => void;
  handleApiError: (error: any, retry?: () => void) => void;
  handleAsyncError: <T>(
    asyncFn: () => Promise<T>,
    context?: string
  ) => Promise<T | null>;
  clearErrors: () => void;
  clearErrorsByType: (type: AppError['type']) => void;
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const {
    addError,
    addApiError,
    addNetworkError,
    addAuthError,
    addValidationError,
    addPermissionError,
    clearErrors,
    clearErrorsByType
  } = useError();

  // מטפל בשגיאות כלליות
  const handleError = useCallback((error: any, context?: string) => {
    console.error('Error occurred:', error, context);

    let errorMessage = 'אירעה שגיאה לא צפויה';
    let errorType: AppError['type'] = 'unknown';
    let severity: AppError['severity'] = 'medium';

    // זיהוי סוג השגיאה
    if (error?.response) {
      // שגיאות HTTP
      const status = error.response.status;
      const data = error.response.data;
      
      errorMessage = data?.message || `שגיאת שרת (${status})`;
      errorType = 'api';
      
      if (status === 401) {
        errorType = 'auth';
        errorMessage = 'נדרשת התחברות מחדש';
        severity = 'high';
      } else if (status === 403) {
        errorType = 'permission';
        errorMessage = 'אין לך הרשאה לבצע פעולה זו';
        severity = 'medium';
      } else if (status === 422) {
        errorType = 'validation';
        errorMessage = data?.message || 'נתונים לא תקינים';
        severity = 'low';
      } else if (status >= 500) {
        errorMessage = 'שגיאת שרת פנימית';
        severity = 'high';
      }
    } else if (error?.request) {
      // שגיאות רשת
      errorType = 'network';
      errorMessage = 'בעיית חיבור לשרת';
      severity = 'high';
    } else if (error?.message) {
      // שגיאות JavaScript
      errorMessage = error.message;
    }

    addError({
      type: errorType,
      severity,
      message: errorMessage,
      details: {
        originalError: error,
        context,
        stack: error?.stack,
        timestamp: new Date().toISOString()
      },
      source: context || 'Unknown'
    });
  }, [addError]);

  // מטפל בשגיאות API עם אפשרות retry
  const handleApiError = useCallback((error: any, retry?: () => void) => {
    console.error('API Error:', error);

    if (error?.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        addAuthError(data?.message || 'נדרשת התחברות מחדש');
      } else if (status === 403) {
        addPermissionError(data?.message || 'אין לך הרשאה לבצע פעולה זו');
      } else if (status === 422) {
        addValidationError(data?.message || 'נתונים לא תקינים', data?.errors);
      } else {
        addApiError(
          data?.message || `שגיאת שרת (${status})`,
          { status, data },
          retry
        );
      }
    } else if (error?.request) {
      addNetworkError('בעיית חיבור לשרת', retry);
    } else {
      addApiError(error?.message || 'שגיאה לא ידועה', error, retry);
    }
  }, [addApiError, addNetworkError, addAuthError, addValidationError, addPermissionError]);

  // מטפל בפונקציות async עם טיפול בשגיאות אוטומטי
  const handleAsyncError = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      handleError(error, context);
      return null;
    }
  }, [handleError]);

  return {
    handleError,
    handleApiError,
    handleAsyncError,
    clearErrors,
    clearErrorsByType
  };
}

// Hook נוסף למקרים ספציפיים
export function useApiErrorHandler() {
  const { handleApiError } = useErrorHandler();
  
  return useCallback((error: any, retry?: () => void) => {
    handleApiError(error, retry);
  }, [handleApiError]);
}

// Hook לטיפול בשגיאות form validation
export function useFormErrorHandler() {
  const { addValidationError, clearErrorsByType } = useError();
  
  const handleFormErrors = useCallback((errors: Record<string, string[]>) => {
    clearErrorsByType('validation');
    
    Object.entries(errors).forEach(([field, messages]) => {
      messages.forEach(message => {
        addValidationError(`${field}: ${message}`, { field });
      });
    });
  }, [addValidationError, clearErrorsByType]);
  
  return { handleFormErrors };
}

export default useErrorHandler;