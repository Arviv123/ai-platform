'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  organizationId?: string;
  mfaEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, mfaToken?: string) => Promise<{ success: boolean; requiresMfa?: boolean; error?: string }>;
  logout: () => void;
  register: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ success: boolean; error?: string }>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.onrender.com';

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Get token from localStorage
  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || localStorage.getItem('auth_token');
    }
    return null;
  };

  // Set token in localStorage
  const setToken = (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('authToken', token);
      // Remove old token key for migration
      localStorage.removeItem('auth_token');
    }
  };

  // Remove token from localStorage
  const removeToken = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth_token'); // Remove old key too
    }
  };

  // API call helper with auth header
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Token expired or invalid
      removeToken();
      setUser(null);
      throw new Error('Authentication required');
    }

    return response;
  };

  // Load user data from token
  const refreshAuth = async () => {
    try {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await apiCall('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setUser(data.user);
        } else {
          removeToken();
        }
      } else {
        removeToken();
      }
    } catch (error) {
      console.error('Auth refresh failed:', error);
      removeToken();
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (email: string, password: string, mfaToken?: string) => {
    try {
      const response = await apiCall('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(mfaToken && { 'X-MFA-Token': mfaToken }),
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        if (data.requireMfa) {
          return { success: false, requiresMfa: true };
        }

        setToken(data.accessToken);
        setUser(data.user);
        return { success: true };
      } else {
        return { 
          success: false, 
          error: data.message || 'Login failed',
          requiresMfa: data.requireMfa 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      };
    }
  };

  // Register function
  const register = async (email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      const response = await apiCall('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password, 
          firstName, 
          lastName,
          agreeTerms: true
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setToken(data.accessToken);
        setUser(data.user);
        return { success: true };
      } else {
        return { 
          success: false, 
          error: data.message || 'Registration failed' 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: 'Network error. Please try again.' 
      };
    }
  };

  // Logout function
  const logout = () => {
    removeToken();
    setUser(null);
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  };

  // Check authentication on mount
  useEffect(() => {
    refreshAuth();
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};