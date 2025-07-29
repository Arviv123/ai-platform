'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'error'>('checking');

  const checkHealth = async () => {
    try {
      const response = await fetch('http://localhost:3001/health');
      if (response.ok) {
        setHealthStatus('healthy');
      } else {
        setHealthStatus('error');
      }
    } catch (error) {
      setHealthStatus('error');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-6">
            🤖 <span className="gradient-text">AI Platform</span>
          </h1>
          <div className="flex justify-center items-center space-x-4 mb-8">
            <div 
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                healthStatus === 'healthy' ? 'bg-green-600/20 text-green-300' : 
                healthStatus === 'error' ? 'bg-red-600/20 text-red-300' : 
                'bg-yellow-600/20 text-yellow-300'
              }`}
            >
              {healthStatus === 'healthy' ? '✅ מערכת פעילה' : 
               healthStatus === 'error' ? '❌ שגיאת חיבור' : 
               '⏳ בודק חיבור...'}
            </div>
          </div>
        </div>

        {/* Main CTA */}
        <div className="text-center mb-8">
          {isAuthenticated ? (
            <a 
              href="/chat" 
              className="inline-block px-12 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-2xl font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              🚀 התחל צ'אט
            </a>
          ) : (
            <a 
              href="/auth/login" 
              className="inline-block px-12 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-2xl font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              🚀 התחל צ'אט
            </a>
          )}
        </div>

        {/* User Status & Subscription */}
        {isAuthenticated && (
          <div className="glass p-6 rounded-xl text-center mb-8 max-w-md">
            <p className="text-white mb-2">👋 שלום, {user?.email}</p>
            <p className="text-blue-200 text-sm mb-4">תוכנית: חינם | קרדיטים: 85/100</p>
            <a 
              href="/pricing" 
              className="inline-block px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-lg transition-colors"
            >
              ⭐ שדרג תוכנית
            </a>
          </div>
        )}

        {/* Secondary Actions */}
        <div className="flex flex-wrap justify-center gap-4">
          {!isAuthenticated && (
            <>
              <a 
                href="/auth/register" 
                className="glass px-6 py-3 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                הרשמה
              </a>
              <a 
                href="/auth/login" 
                className="glass px-6 py-3 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                התחברות
              </a>
            </>
          )}
          <a 
            href="/pricing" 
            className="glass px-6 py-3 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            💰 תמחור
          </a>
        </div>
      </div>
    </div>
  );
}
