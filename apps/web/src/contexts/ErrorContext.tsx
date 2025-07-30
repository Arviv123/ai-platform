'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

// Types
export interface AppError {
  id: string;
  message: string;
  type: 'api' | 'validation' | 'network' | 'auth' | 'permission' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  details?: any;
  source?: string;
  retry?: () => void;
}

interface ErrorState {
  errors: AppError[];
  isLoading: boolean;
  lastError?: AppError;
}

// Actions
type ErrorAction =
  | { type: 'ADD_ERROR'; payload: Omit<AppError, 'id' | 'timestamp'> }
  | { type: 'REMOVE_ERROR'; payload: string }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_BY_TYPE'; payload: AppError['type'] };

// Initial state
const initialState: ErrorState = {
  errors: [],
  isLoading: false
};

// Reducer
function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  switch (action.type) {
    case 'ADD_ERROR': {
      const newError: AppError = {
        ...action.payload,
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };
      
      return {
        ...state,
        errors: [...state.errors, newError],
        lastError: newError
      };
    }
    
    case 'REMOVE_ERROR':
      return {
        ...state,
        errors: state.errors.filter(error => error.id !== action.payload)
      };
    
    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
        lastError: undefined
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    
    case 'CLEAR_BY_TYPE':
      return {
        ...state,
        errors: state.errors.filter(error => error.type !== action.payload)
      };
    
    default:
      return state;
  }
}

// Context
interface ErrorContextType {
  state: ErrorState;
  addError: (error: Omit<AppError, 'id' | 'timestamp'>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  clearErrorsByType: (type: AppError['type']) => void;
  setLoading: (loading: boolean) => void;
  
  // Helper methods
  addApiError: (message: string, details?: any, retry?: () => void) => void;
  addValidationError: (message: string, details?: any) => void;
  addNetworkError: (message: string, retry?: () => void) => void;
  addAuthError: (message: string) => void;
  addPermissionError: (message: string) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

// Provider component
interface ErrorProviderProps {
  children: ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [state, dispatch] = useReducer(errorReducer, initialState);

  const addError = (error: Omit<AppError, 'id' | 'timestamp'>) => {
    const errorWithId = { ...error, id: generateId(), timestamp: new Date() };
    dispatch({ type: 'ADD_ERROR', payload: error });
    
    // Auto-remove non-critical errors after 5 seconds
    if (error.severity !== 'critical') {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_ERROR', payload: errorWithId.id });
      }, 5000);
    }
  };

  const removeError = (id: string) => {
    dispatch({ type: 'REMOVE_ERROR', payload: id });
  };

  const clearErrors = () => {
    dispatch({ type: 'CLEAR_ERRORS' });
  };

  const clearErrorsByType = (type: AppError['type']) => {
    dispatch({ type: 'CLEAR_BY_TYPE', payload: type });
  };

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  // Helper methods for common error types
  const addApiError = (message: string, details?: any, retry?: () => void) => {
    addError({
      type: 'api',
      severity: 'medium',
      message,
      details,
      retry,
      source: 'API'
    });
  };

  const addValidationError = (message: string, details?: any) => {
    addError({
      type: 'validation',
      severity: 'low',
      message,
      details,
      source: 'Validation'
    });
  };

  const addNetworkError = (message: string, retry?: () => void) => {
    addError({
      type: 'network',
      severity: 'high',
      message: message || 'בעיית רשת - אנא בדוק את החיבור לאינטרנט',
      retry,
      source: 'Network'
    });
  };

  const addAuthError = (message: string) => {
    addError({
      type: 'auth',
      severity: 'high',
      message: message || 'נדרשת התחברות מחדש',
      source: 'Authentication'
    });
  };

  const addPermissionError = (message: string) => {
    addError({
      type: 'permission',
      severity: 'medium',
      message: message || 'אין לך הרשאה לבצע פעולה זו',
      source: 'Authorization'
    });
  };

  const value: ErrorContextType = {
    state,
    addError,
    removeError,
    clearErrors,
    clearErrorsByType,
    setLoading,
    addApiError,
    addValidationError,
    addNetworkError,
    addAuthError,
    addPermissionError
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
}

// Hook
export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

export default ErrorContext;