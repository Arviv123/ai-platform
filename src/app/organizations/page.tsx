'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
  description: string;
  planType: 'free' | 'pro' | 'enterprise';
  userCount: number;
  createdAt: string;
  status: 'active' | 'suspended' | 'pending';
  settings: {
    maxUsers: number;
    maxServers: number;
    features: string[];
  };
}

interface CreateOrgForm {
  name: string;
  description: string;
  planType: 'free' | 'pro' | 'enterprise';
}

export default function OrganizationsPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrgForm>({
    name: '',
    description: '',
    planType: 'free'
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      // Only admins and super admins can access this page
      if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
        router.push('/dashboard');
        showToast('Access denied - Admin privileges required', 'error');
        return;
      }
      
      loadOrganizations();
    }
  }, [isAuthenticated, isLoading, router, user]);

  const loadOrganizations = async () => {
    setIsLoadingData(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/organizations', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.data || []);
      } else {
        showToast('Failed to load organizations', 'error');
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      showToast('Network error loading organizations', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      });

      if (response.ok) {
        showToast('Organization created successfully!', 'success');
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '', planType: 'free' });
        loadOrganizations();
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to create organization', 'error');
      }
    } catch (error) {
      showToast('Network error creating organization', 'error');
    }
  };

  const handleStatusChange = async (orgId: string, newStatus: 'active' | 'suspended') => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`http://localhost:3005/api/organizations/${orgId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        showToast(`Organization ${newStatus}!`, 'success');
        loadOrganizations();
      } else {
        showToast('Failed to update organization status', 'error');
      }
    } catch (error) {
      showToast('Network error updating status', 'error');
    }
  };

  const getPlanTypeColor = (planType: string) => {
    switch (planType) {
      case 'free': return 'bg-gray-600';
      case 'pro': return 'bg-blue-600';
      case 'enterprise': return 'bg-purple-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'status-healthy';
      case 'suspended': return 'status-error';
      case 'pending': return 'status-warning';
      default: return 'status-inactive';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '🟢';
      case 'suspended': return '🔴';
      case 'pending': return '🟡';
      default: return '⚫';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🏢 Organizations
            </h1>
            <p className="text-blue-200">
              Manage organizations and multi-tenancy settings
            </p>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              ← Dashboard
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              ➕ Create Organization
            </button>
          </div>
        </div>

        {/* Organizations Grid */}
        {isLoadingData ? (
          <div className="flex justify-center items-center h-64">
            <div className="spinner"></div>
          </div>
        ) : organizations.length === 0 ? (
          <div className="glass p-8 rounded-xl text-center">
            <div className="text-4xl mb-4">🏢</div>
            <h3 className="text-xl font-semibold text-white mb-2">No Organizations</h3>
            <p className="text-blue-200 mb-4">Create your first organization to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Create Organization
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <div key={org.id} className="glass p-6 rounded-xl">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-white">{org.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getPlanTypeColor(org.planType)}`}>
                        {org.planType.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-blue-200 text-sm mb-2">{org.description}</p>
                  </div>
                  <div className={`flex items-center space-x-1 ${getStatusColor(org.status)}`}>
                    <span>{getStatusIcon(org.status)}</span>
                    <span className="text-sm font-medium capitalize">{org.status}</span>
                  </div>
                </div>

                {/* Organization Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-blue-200 text-xs">Users</p>
                    <p className="text-white font-medium">
                      {org.userCount} / {org.settings.maxUsers}
                    </p>
                    <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min((org.userCount / org.settings.maxUsers) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-blue-200 text-xs">Max Servers</p>
                    <p className="text-white font-medium">{org.settings.maxServers}</p>
                  </div>
                </div>

                {/* Features */}
                {org.settings.features && org.settings.features.length > 0 && (
                  <div className="mb-4">
                    <p className="text-blue-200 text-xs mb-2">Features:</p>
                    <div className="flex flex-wrap gap-1">
                      {org.settings.features.slice(0, 3).map((feature, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-600/30 text-blue-200 text-xs rounded"
                        >
                          {feature}
                        </span>
                      ))}
                      {org.settings.features.length > 3 && (
                        <span className="px-2 py-1 bg-gray-600/30 text-gray-300 text-xs rounded">
                          +{org.settings.features.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Created Date */}
                <p className="text-blue-200 text-xs mb-4">
                  Created: {new Date(org.createdAt).toLocaleDateString()}
                </p>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => router.push(`/organizations/${org.id}`)}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    Manage
                  </button>
                  
                  {org.status === 'active' ? (
                    <button
                      onClick={() => handleStatusChange(org.id, 'suspended')}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      Suspend
                    </button>
                  ) : org.status === 'suspended' ? (
                    <button
                      onClick={() => handleStatusChange(org.id, 'active')}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                    >
                      Activate
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Organization Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass p-6 rounded-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Create Organization</h2>
              
              <form onSubmit={handleCreateOrganization} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="My Organization"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Description
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Organization description..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Plan Type
                  </label>
                  <select
                    value={createForm.planType}
                    onChange={(e) => setCreateForm({ ...createForm, planType: e.target.value as 'free' | 'pro' | 'enterprise' })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="free">Free Plan</option>
                    <option value="pro">Pro Plan</option>
                    <option value="enterprise">Enterprise Plan</option>
                  </select>
                </div>

                {/* Plan Details */}
                <div className="bg-white/5 p-4 rounded-lg">
                  <h4 className="text-white font-medium mb-2">Plan Features:</h4>
                  <ul className="text-blue-200 text-sm space-y-1">
                    {createForm.planType === 'free' && (
                      <>
                        <li>• Up to 5 users</li>
                        <li>• 2 MCP servers</li>
                        <li>• Basic support</li>
                      </>
                    )}
                    {createForm.planType === 'pro' && (
                      <>
                        <li>• Up to 50 users</li>
                        <li>• 10 MCP servers</li>
                        <li>• Priority support</li>
                        <li>• Advanced analytics</li>
                      </>
                    )}
                    {createForm.planType === 'enterprise' && (
                      <>
                        <li>• Unlimited users</li>
                        <li>• Unlimited MCP servers</li>
                        <li>• 24/7 support</li>
                        <li>• Custom integrations</li>
                        <li>• SLA guarantee</li>
                      </>
                    )}
                  </ul>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}