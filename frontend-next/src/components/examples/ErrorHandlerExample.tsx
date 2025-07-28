'use client';

import React, { useState } from 'react';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { api, getErrorMessage } from '@/lib/api';

const ErrorHandlerExample: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { handleError, handleApiError, handleAsyncError } = useErrorHandler();

  // דוגמה 1: טיפול בשגיאת API
  const handleApiTest = async () => {
    setIsLoading(true);
    try {
      // ניסיון לגשת לendpoint שלא קיים
      await api.get('/api/nonexistent-endpoint');
    } catch (error) {
      handleApiError(error, () => handleApiTest()); // retry function
    } finally {
      setIsLoading(false);
    }
  };

  // דוגמה 2: טיפול בשגיאה עם handleAsyncError
  const handleAsyncTest = async () => {
    setIsLoading(true);
    const result = await handleAsyncError(async () => {
      // סימולציה של פונקציה שזורקת שגיאה
      throw new Error('זוהי שגיאה לדוגמה');
    }, 'AsyncTest');
    
    if (result === null) {
      console.log('הפונקציה נכשלה');
    }
    setIsLoading(false);
  };

  // דוגמה 3: זריקת שגיאות שונות
  const throwValidationError = () => {
    const error = {
      response: {
        status: 422,
        data: {
          message: 'נתונים לא תקינים',
          errors: {
            email: ['כתובת אימייל לא תקינה'],
            password: ['סיסמה חייבת להכיל לפחות 8 תווים']
          }
        }
      }
    };
    handleError(error, 'ValidationTest');
  };

  const throwNetworkError = () => {
    const error = {
      request: {},
      message: 'Network Error'
    };
    handleError(error, 'NetworkTest');
  };

  const throwAuthError = () => {
    const error = {
      response: {
        status: 401,
        data: {
          message: 'Token expired'
        }
      }
    };
    handleError(error, 'AuthTest');
  };

  const throwCriticalError = () => {
    // זה יגרום ל-ErrorBoundary לתפוס את השגיאה
    throw new Error('Critical error that breaks component');
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        דוגמאות לטיפול בשגיאות
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleApiTest}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'טוען...' : 'בדיקת API Error'}
        </button>

        <button
          onClick={handleAsyncTest}
          disabled={isLoading}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'טוען...' : 'בדיקת Async Error'}
        </button>

        <button
          onClick={throwValidationError}
          className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
        >
          שגיאת ולידציה
        </button>

        <button
          onClick={throwNetworkError}
          className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
        >
          שגיאת רשת
        </button>

        <button
          onClick={throwAuthError}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          שגיאת אימות
        </button>

        <button
          onClick={throwCriticalError}
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 transition-colors"
        >
          שגיאה קריטית (ErrorBoundary)
        </button>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">הוראות שימוש:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• לחץ על הכפתורים לראות סוגי שגיאות שונים</li>
          <li>• השגיאות יוצגו בפינה הימנית העליונה</li>
          <li>• השגיאה הקריטית תגרום לErrorBoundary להציג מסך שגיאה</li>
          <li>• ניתן לסגור שגיאות בלחיצה על X או להמתין לסגירה אוטומטית</li>
        </ul>
      </div>
    </div>
  );
};

export default ErrorHandlerExample;