'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  totalUsers: number;
  activeServers: number;
  totalRequests: number;
  systemHealth: 'healthy' | 'warning' | 'error';
}

interface Organization {
  id: string;
  name: string;
  userCount: number;
  planType: string;
}

export default function DashboardPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);

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
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      // Load stats
      const statsResponse = await fetch('http://localhost:4000/api/gateway/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      // Load organizations if user is admin
      if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
        const orgsResponse = await fetch('http://localhost:4000/api/organizations', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (orgsResponse.ok) {
          const orgsData = await orgsResponse.json();
          setOrganizations(orgsData.data);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showToast('Failed to load dashboard data', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Check if user is admin
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {isAdmin ? '📊 Admin Dashboard' : '🏠 User Dashboard'}
            </h1>
            <p className="text-blue-200">
              Welcome back, {user?.firstName || user?.email} ({user?.role})
            </p>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={() => router.push('/chat')}
              className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              💬 Chat
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              👤 Profile
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => router.push('/mcp')}
                  className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  🤖 MCP Servers
                </button>
                <button
                  onClick={() => router.push('/security')}
                  className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  🔐 Security
                </button>
                <button
                  onClick={() => router.push('/monitoring')}
                  className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                  📈 Monitoring
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats Grid - Admin Only */}
        {isAdmin && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">Total Users</p>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                </div>
                <div className="text-2xl">👥</div>
              </div>
            </div>
            
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">Active Servers</p>
                  <p className="text-2xl font-bold text-white">{stats.activeServers}</p>
                </div>
                <div className="text-2xl">🤖</div>
              </div>
            </div>
            
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">Total Requests</p>
                  <p className="text-2xl font-bold text-white">{stats.totalRequests.toLocaleString()}</p>
                </div>
                <div className="text-2xl">📊</div>
              </div>
            </div>
            
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-sm">System Health</p>
                  <p className={`text-lg font-semibold ${
                    stats.systemHealth === 'healthy' ? 'text-green-400' :
                    stats.systemHealth === 'warning' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {stats.systemHealth === 'healthy' ? '🟢 Healthy' :
                     stats.systemHealth === 'warning' ? '🟡 Warning' : '🔴 Error'}
                  </p>
                </div>
                <div className="text-2xl">❤️</div>
              </div>
            </div>
          </div>
        )}

        {/* Organizations (for admins) */}
        {isAdmin && (
          <div className="glass p-6 rounded-xl mb-8">
            <h2 className="text-xl font-bold text-white mb-4">🏢 Organizations</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-blue-200 pb-3">Name</th>
                    <th className="text-left text-blue-200 pb-3">Users</th>
                    <th className="text-left text-blue-200 pb-3">Plan</th>
                    <th className="text-left text-blue-200 pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((org) => (
                    <tr key={org.id} className="border-b border-white/5">
                      <td className="py-3 text-white">{org.name}</td>
                      <td className="py-3 text-blue-200">{org.userCount}</td>
                      <td className="py-3 text-blue-200">{org.planType}</td>
                      <td className="py-3">
                        <button
                          onClick={() => router.push(`/organizations/${org.id}`)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chat - Available to all users */}
          <div className="glass p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-3">💬 Chat</h3>
            <p className="text-blue-200 text-sm mb-4">Start a conversation with AI</p>
            <button
              onClick={() => router.push('/chat')}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Go to Chat
            </button>
          </div>

          {/* Profile - Available to all users */}
          <div className="glass p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-3">👤 Profile</h3>
            <p className="text-blue-200 text-sm mb-4">Manage your account settings</p>
            <button
              onClick={() => router.push('/profile')}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
            >
              View Profile
            </button>
          </div>

          {/* Admin-only actions */}
          {isAdmin && (
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-3">🤖 MCP Management</h3>
              <p className="text-blue-200 text-sm mb-4">Manage your MCP servers and tools</p>
              <button
                onClick={() => router.push('/mcp')}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
              >
                Go to MCP
              </button>
            </div>
          )}
        </div>

        {/* Additional admin-only actions row */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-3">🔐 Security Settings</h3>
              <p className="text-blue-200 text-sm mb-4">Configure MFA and security policies</p>
              <button
                onClick={() => router.push('/security')}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Security Settings
              </button>
            </div>
            
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-white mb-3">📈 Analytics</h3>
              <p className="text-blue-200 text-sm mb-4">View system performance and usage</p>
              <button
                onClick={() => router.push('/monitoring')}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors"
              >
                View Analytics
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}