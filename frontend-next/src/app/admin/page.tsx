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
      
      // Load mock data - replace with real API calls
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
          email: 'user@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
          lastLogin: '2025-07-28T20:00:00Z',
          createdAt: '2025-07-28T10:00:00Z',
          organization: { name: 'Test Org', plan: 'PRO' }
        },
        {
          id: '2',
          email: 'admin@example.com',
          firstName: 'System',
          lastName: 'Administrator',
          role: 'ADMIN',
          lastLogin: '2025-07-28T21:00:00Z',
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
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
              <h1 className="text-2xl font-bold text-white">🛠️ Admin Dashboard</h1>
              <p className="text-purple-200">Manage your AI Platform</p>
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
            { id: 'overview', label: '📊 Overview', icon: '📊' },
            { id: 'users', label: '👥 Users', icon: '👥' },
            { id: 'subscriptions', label: '💳 Subscriptions', icon: '💳' },
            { id: 'analytics', label: '📈 Analytics', icon: '📈' },
            { id: 'settings', label: '⚙️ Settings', icon: '⚙️' }
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
                    <p className="text-purple-200 text-sm">Total Users</p>
                    <p className="text-3xl font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +12%</span>
                  <span className="text-purple-200 text-sm ml-2">from last month</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">Active Users</p>
                    <p className="text-3xl font-bold text-white">{stats.activeUsers.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🟢</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +8%</span>
                  <span className="text-purple-200 text-sm ml-2">from last week</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">Monthly Revenue</p>
                    <p className="text-3xl font-bold text-white">{formatCurrency(stats.revenue)}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💰</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +23%</span>
                  <span className="text-purple-200 text-sm ml-2">from last month</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">Chat Sessions</p>
                    <p className="text-3xl font-bold text-white">{stats.totalSessions.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">💬</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +34%</span>
                  <span className="text-purple-200 text-sm ml-2">from last month</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">Total Messages</p>
                    <p className="text-3xl font-bold text-white">{stats.totalMessages.toLocaleString()}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📨</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +45%</span>
                  <span className="text-purple-200 text-sm ml-2">from last month</span>
                </div>
              </div>

              <div className="glass p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-200 text-sm">Active Subscriptions</p>
                    <p className="text-3xl font-bold text-white">{stats.activeSubscriptions}</p>
                  </div>
                  <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">📋</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center">
                  <span className="text-green-400 text-sm">↗ +18%</span>
                  <span className="text-purple-200 text-sm ml-2">from last month</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass p-6 rounded-xl">
              <h3 className="text-xl font-semibold text-white mb-4">📊 Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors">
                  <div className="text-2xl mb-2">👥</div>
                  <div className="font-medium">Manage Users</div>
                </button>
                <button className="p-4 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors">
                  <div className="text-2xl mb-2">💳</div>
                  <div className="font-medium">View Billing</div>
                </button>
                <button className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors">
                  <div className="text-2xl mb-2">🔧</div>
                  <div className="font-medium">System Settings</div>
                </button>
                <button className="p-4 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition-colors">
                  <div className="text-2xl mb-2">📈</div>
                  <div className="font-medium">View Reports</div>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">👥 User Management</h3>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                + Add User
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-purple-200 py-3">User</th>
                    <th className="text-left text-purple-200 py-3">Role</th>
                    <th className="text-left text-purple-200 py-3">Organization</th>
                    <th className="text-left text-purple-200 py-3">Last Login</th>
                    <th className="text-left text-purple-200 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-4">
                        <div>
                          <div className="text-white font-medium">{user.firstName} {user.lastName}</div>
                          <div className="text-purple-200 text-sm">{user.email}</div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium $
                          user.role === 'ADMIN' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4">
                        {user.organization ? (
                          <div>
                            <div className="text-white text-sm">{user.organization.name}</div>
                            <div className="text-purple-200 text-xs">{user.organization.plan}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No Organization</span>
                        )}
                      </td>
                      <td className="py-4 text-purple-200 text-sm">
                        {formatDate(user.lastLogin)}
                      </td>
                      <td className="py-4">
                        <div className="flex space-x-2">
                          <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors">
                            Edit
                          </button>
                          <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors">
                            Delete
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

        {/* Other tabs content can be added here */}
        {activeTab !== 'overview' && activeTab !== 'users' && (
          <div className="glass p-6 rounded-xl text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold text-white mb-2">Coming Soon</h3>
            <p className="text-purple-200">This section is under development</p>
          </div>
        )}
      </div>
    </div>
  );
}