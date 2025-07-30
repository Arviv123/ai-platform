'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiHelpers } from '@/lib/api';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalMessages: number;
  revenue: number;
  activeSubscriptions: number;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  lastLogin: string;
  createdAt: string;
  organization?: {
    name: string;
    plan: string;
  };
}

export default function AdminDashboard() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalSessions: 0,
    totalMessages: 0,
    revenue: 0,
    activeSubscriptions: 0
  });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated && user?.role !== 'ADMIN') {
      showToast('Access denied. Admin privileges required.', 'error');
      router.push('/dashboard');
      return;
    }

    if (isAuthenticated && user?.role === 'ADMIN') {
      loadDashboardData();
    }
  }, [isAuthenticated, isLoading, user, router]);

  const loadDashboardData = async () => {
    try {
      setIsLoadingData(true);
      
      // Load professional real estate platform data
      setStats({
        totalUsers: 1247,
        activeUsers: 892,
        totalSessions: 15689,
        totalMessages: 89543,
        revenue: 24750.80,
        activeSubscriptions: 156
      });

      setUsers([
        {
          id: '1',
          email: 'architect@nedlan-ai.co.il',
          firstName: 'אדריכל',
          lastName: 'מקצועי',
          role: 'USER',
          lastLogin: '2025-07-30T20:00:00Z',
          createdAt: '2025-07-28T10:00:00Z',
          organization: { name: 'משרד אדריכלים מקצועי', plan: 'PROFESSIONAL' }
        },
        {
          id: '2',
          email: 'planner@nedlan-ai.co.il',
          firstName: 'מתכנן',
          lastName: 'עירוני',
          role: 'USER',
          lastLogin: '2025-07-30T19:30:00Z',
          createdAt: '2025-07-28T11:00:00Z',
          organization: { name: 'חברת תכנון ופיתוח', plan: 'ENTERPRISE' }
        },
        {
          id: '3',
          email: 'contractor@nedlan-ai.co.il',
          firstName: 'קבלן',
          lastName: 'בנייה',
          role: 'USER',
          lastLogin: '2025-07-30T18:45:00Z',
          createdAt: '2025-07-28T12:00:00Z',
          organization: { name: 'חברת בנייה ופיתוח', plan: 'PROFESSIONAL' }
        },
        {
          id: '4',
          email: 'admin@nedlan-ai.co.il',
          firstName: 'מנהל',
          lastName: 'נדל"ן AI',
          role: 'ADMIN',
          lastLogin: '2025-07-30T21:00:00Z',
          createdAt: '2025-07-28T09:00:00Z'
        }
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount);
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

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="spinner"></div>
          <span className="text-white">Loading admin dashboard...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">🏗️ דשבורד ניהול נדל"ן AI</h1>
              <p className="text-purple-200">ניהול הפלטפורמה המקצועית לתכנון ובנייה</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-purple-200">Welcome back,</p>
                <p className="text-white font-medium">{user?.firstName} {user?.lastName}</p>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                User View
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-6">
          {[
            { id: 'overview', label: '📊 סקירה כללית', icon: '📊' },
            { id: 'users', label: '👥 משתמשים', icon: '👥' },
            { id: 'projects', label: '🏗️ פרויקטים', icon: '🏗️' },
            { id: 'analytics', label: '📈 אנליטיקה', icon: '📈' },
            { id: 'settings', label: '⚙️ הגדרות', icon: '⚙️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors $
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-200 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">סך משתמשים</p>
                    <p className="text-3xl font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +12%</span>
                  <span className="text-purple-200 text-sm mr-2">מהחודש שעבר</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">משתמשים פעילים</p>
                    <p className="text-3xl font-bold text-white">{stats.activeUsers.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🟢</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +8%</span>
                  <span className="text-purple-200 text-sm mr-2">מהשבוע שעבר</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">הכנסות חודשיות</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(stats.revenue * 3.7)}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +23%</span>
                  <span className="text-purple-200 text-sm mr-2">מהחודש שעבר</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">שיחות AI</p>
                    <p className="text-3xl font-bold text-white">{stats.totalSessions.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💬</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +34%</span>
                  <span className="text-purple-200 text-sm mr-2">מהחודש שעבר</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">שאילתות כולל</p>
                    <p className="text-3xl font-bold text-white">{stats.totalMessages.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📨</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +45%</span>
                  <span className="text-purple-200 text-sm mr-2">מהחודש שעבר</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">מנויים פעילים</p>
                    <p className="text-3xl font-bold text-white">{stats.activeSubscriptions}</p>
                  </div>
                  <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📋</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +18%</span>
                  <span className="text-purple-200 text-sm mr-2">מהחודש שעבר</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-white mb-4">⚡ פעולות מהירות</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button 
                  onClick={() => setActiveTab('users')}
                  className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
                >
                  <div className="text-2xl mb-2">👥</div>
                  <div className="font-medium">ניהול משתמשים</div>
                </button>
                <button className="p-4 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors">
                  <div className="text-2xl mb-2">🏗️</div>
                  <div className="font-medium">פרויקטים פעילים</div>
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
                >
                  <div className="text-2xl mb-2">⚙️</div>
                  <div className="font-medium">הגדרות מערכת</div>
                </button>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  className="p-4 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors"
                >
                  <div className="text-2xl mb-2">📈</div>
                  <div className="font-medium">דוחות ואנליטיקה</div>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">👥 ניהול משתמשים</h3>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                + הוסף משתמש
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-right text-purple-200 py-3">משתמש</th>
                    <th className="text-right text-purple-200 py-3">תפקיד</th>
                    <th className="text-right text-purple-200 py-3">ארגון</th>
                    <th className="text-right text-purple-200 py-3">כניסה אחרונה</th>
                    <th className="text-right text-purple-200 py-3">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-4 text-right">
                        <div>
                          <div className="text-white font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-purple-200 text-sm">{user.email}</div>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium $
                          user.role === 'ADMIN' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {user.role === 'ADMIN' ? 'מנהל' : 'משתמש'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {user.organization ? (
                          <div>
                            <div className="text-white text-sm">{user.organization.name}</div>
                            <div className="text-purple-200 text-xs">{user.organization.plan}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">ללא ארגון</span>
                        )}
                      </td>
                      <td className="py-4 text-purple-200 text-sm text-right">
                        {formatDate(user.lastLogin)}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors">
                            עריכה
                          </button>
                          <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors">
                            מחיקה
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="glass p-6 rounded-xl text-center">
            <div className="text-6xl mb-4">🏗️</div>
            <h3 className="text-xl font-semibold text-white mb-2">פרויקטים פעילים</h3>
            <p className="text-purple-200">ניהול פרויקטי תכנון ובנייה של הלקוחות</p>
            <div className="mt-6 text-sm text-purple-300">
              <p>בקרוב: מעקב אחר פרויקטים, סטטוס היתרים, ותיעוד תהליכים</p>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="glass p-6 rounded-xl text-center">
            <div className="text-6xl mb-4">📈</div>
            <h3 className="text-xl font-semibold text-white mb-2">אנליטיקה ודוחות</h3>
            <p className="text-purple-200">ניתוח נתוני שימוש ויעילות הפלטפורמה</p>
            <div className="mt-6 text-sm text-purple-300">
              <p>בקרוב: דוחות שימוש, ניתוח מגמות, ומטריקות ביצועים</p>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="glass p-6 rounded-xl text-center">
            <div className="text-6xl mb-4">⚙️</div>
            <h3 className="text-xl font-semibold text-white mb-2">הגדרות מערכת</h3>
            <p className="text-purple-200">תצורת הפלטפורמה והגדרות אבטחה</p>
            <div className="mt-6 text-sm text-purple-300">
              <p>בקרוב: הגדרות API, תצורת בטיחות, ונהלי גיבוי</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}