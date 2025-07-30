'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiHelpers } from '@/lib/api';

interface UserStats {
  totalSessions: number;
  totalMessages: number;
  tokensUsed: number;
  tokensLimit: number;
  plan: string;
  planFeatures: string[];
}

interface RecentSession {
  id: string;
  title: string;
  model: string;
  messageCount: number;
  updatedAt: string;
}

export default function Dashboard() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [stats, setStats] = useState<UserStats>({
    totalSessions: 0,
    totalMessages: 0,
    tokensUsed: 0,
    tokensLimit: 100000,
    plan: 'Free',
    planFeatures: []
  });
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, isLoading, router]);

  const loadDashboardData = async () => {
    try {
      setIsLoadingData(true);
      
      // Load recent sessions
      const sessionsData = await apiHelpers.chat.getSessions();
      if (sessionsData?.data) {
        setRecentSessions(sessionsData.data.slice(0, 5));
        
        // Calculate stats from sessions
        const totalSessions = sessionsData.data.length;
        const totalMessages = sessionsData.data.reduce((sum: number, session: any) => sum + (session._count?.messages || 0), 0);
        const tokensUsed = sessionsData.data.reduce((sum: number, session: any) => sum + (session.totalTokens || 0), 0);
        
        setStats(prev => ({
          ...prev,
          totalSessions,
          totalMessages,
          tokensUsed,
          planFeatures: ['✓ Unlimited conversations', '✓ All AI models', '✓ Basic support']
        }));
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUsagePercentage = () => {
    return Math.min((stats.tokensUsed / stats.tokensLimit) * 100, 100);
  };

  const getUsageColor = () => {
    const percentage = getUsagePercentage();
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="spinner"></div>
          <span className="text-white">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">👋 שלום, {user?.firstName}!</h1>
              <p className="text-blue-200">ברוך הבא לפלטפורמת ה-AI שלך</p>
            </div>
            <div className="flex items-center space-x-4">
              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => router.push('/admin')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  🛠️ Admin Panel
                </button>
              )}
              <button
                onClick={() => router.push('/chat')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                💬 התחל צ'אט חדש
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">💬 שיחות</h3>
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{stats.totalSessions}</p>
            <p className="text-blue-200 text-sm">סך הכל שיחות</p>
          </div>

          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">💌 הודעות</h3>
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📨</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{stats.totalMessages}</p>
            <p className="text-blue-200 text-sm">סך הכל הודעות</p>
          </div>

          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">🎯 Tokens</h3>
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">
              {stats.tokensUsed.toLocaleString()}
            </p>
            <p className="text-blue-200 text-sm">מתוך {stats.tokensLimit.toLocaleString()}</p>
          </div>

          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">📋 תוכנית</h3>
              <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⭐</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-2">{stats.plan}</p>
            <button className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
              שדרג תוכנית →
            </button>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="glass p-6 rounded-xl mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">📊 שימוש חודשי</h3>
            <span className="text-blue-200 text-sm">
              {getUsagePercentage().toFixed(1)}% נוצל
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-4 mb-4">
            <div 
              className={`h-4 rounded-full transition-all duration-300 ${getUsageColor()}`}
              style={{ width: `${getUsagePercentage()}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-200">Tokens בשימוש:</span>
              <span className="text-white font-medium ml-2">{stats.tokensUsed.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-blue-200">מגבלה חודשית:</span>
              <span className="text-white font-medium ml-2">{stats.tokensLimit.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-blue-200">נותר:</span>
              <span className="text-white font-medium ml-2">
                {(stats.tokensLimit - stats.tokensUsed).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Sessions */}
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">📝 שיחות אחרונות</h3>
              <button
                onClick={() => router.push('/chat')}
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                צפה בכל השיחות →
              </button>
            </div>
            
            {recentSessions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-blue-200 mb-4">עדיין לא התחלת שיחות</p>
                <button
                  onClick={() => router.push('/chat')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  התחל צ'אט ראשון
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => router.push(`/chat?session=${session.id}`)}
                    className="p-4 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-white font-medium truncate">{session.title}</h4>
                        <p className="text-blue-200 text-sm mt-1">
                          {session.messageCount} הודעות • {session.model}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-blue-200 text-xs">
                          {formatDate(session.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plan Features */}
          <div className="glass p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">⭐ התוכנית שלך</h3>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-white">{stats.plan}</span>
                <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">פעיל</span>
              </div>
              <div className="space-y-2">
                {stats.planFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center text-blue-200">
                    <span className="text-green-400 mr-2">✓</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <button className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-colors font-medium">
                שדרג לתוכנית Pro
              </button>
              <button className="w-full py-2 text-blue-400 hover:text-blue-300 transition-colors">
                השווה תוכניות
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 glass p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-white mb-4">🚀 פעולות מהירות</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/chat')}
              className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors text-center"
            >
              <div className="text-2xl mb-2">💬</div>
              <div className="font-medium">צ'אט חדש</div>
            </button>
            
            <button
              onClick={() => router.push('/mcp')}
              className="p-4 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors text-center"
            >
              <div className="text-2xl mb-2">🔌</div>
              <div className="font-medium">שרתי MCP</div>
            </button>
            
            <button
              onClick={() => router.push('/profile')}
              className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors text-center"
            >
              <div className="text-2xl mb-2">👤</div>
              <div className="font-medium">פרופיל</div>
            </button>
            
            <button
              onClick={() => router.push('/billing')}
              className="p-4 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors text-center"
            >
              <div className="text-2xl mb-2">💳</div>
              <div className="font-medium">חשבונית</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}