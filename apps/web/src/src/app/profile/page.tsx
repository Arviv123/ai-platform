'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
  organizationId?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    ai: {
      defaultModel: string;
      temperature: number;
      maxTokens: number;
      streamResponses: boolean;
    };
  };
  usage: {
    totalTokens: number;
    totalSessions: number;
    totalMessages: number;
    monthlyTokens: number;
    plan: {
      name: string;
      tokenLimit: number;
      features: string[];
    };
  };
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    created: string;
    lastUsed?: string;
  }>;
}

export default function ProfilePage() {
  const { isAuthenticated, user, isLoading, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'usage' | 'api'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      loadProfile();
    }
  }, [isAuthenticated, isLoading, router]);

  const loadProfile = async () => {
    setIsLoadingData(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.railway.app'}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.data);
      } else {
        showToast('Failed to load profile', 'error');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      showToast('Network error loading profile', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.railway.app'}/api/user/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        showToast('Profile updated successfully!', 'success');
        loadProfile();
        refreshAuth();
        setIsEditing(false);
      } else {
        showToast('Failed to update profile', 'error');
      }
    } catch (error) {
      showToast('Network error updating profile', 'error');
    }
  };

  const createApiKey = async () => {
    if (!newApiKeyName.trim()) {
      showToast('Please enter a name for the API key', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.railway.app'}/api/user/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: newApiKeyName })
      });

      if (response.ok) {
        showToast('API key created successfully!', 'success');
        setShowApiModal(false);
        setNewApiKeyName('');
        loadProfile();
      } else {
        showToast('Failed to create API key', 'error');
      }
    } catch (error) {
      showToast('Network error creating API key', 'error');
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://ai-platform-backend.railway.app'}/api/user/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        showToast('API key deleted', 'success');
        loadProfile();
      } else {
        showToast('Failed to delete API key', 'error');
      }
    } catch (error) {
      showToast('Network error deleting API key', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  if (isLoading || isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              👤 Profile
            </h1>
            <p className="text-blue-200">
              Manage your account settings and preferences
            </p>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={() => router.push('/chat')}
              className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              🤖 Chat
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="glass p-6 rounded-xl">
              {/* Profile Picture */}
              <div className="text-center mb-6">
                <div className="w-24 h-24 bg-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
                  {profile.firstName?.[0]}{profile.lastName?.[0]}
                </div>
                <h3 className="text-white font-semibold">{profile.firstName} {profile.lastName}</h3>
                <p className="text-blue-200 text-sm">{profile.email}</p>
                <span className="inline-block px-3 py-1 bg-blue-600/30 text-blue-200 text-xs rounded-full mt-2">
                  {profile.role}
                </span>
              </div>

              {/* Navigation */}
              <nav className="space-y-2">
                {[
                  { key: 'profile', label: 'Profile Info', icon: '👤' },
                  { key: 'preferences', label: 'Preferences', icon: '⚙️' },
                  { key: 'usage', label: 'Usage & Billing', icon: '📊' },
                  { key: 'api', label: 'API Keys', icon: '🔑' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as 'profile' | 'preferences' | 'usage' | 'api')}
                    className={`w-full p-3 rounded-lg text-left transition-colors flex items-center space-x-3 ${
                      activeTab === tab.key ? 'bg-white/20' : 'hover:bg-white/10'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="text-white">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <div className="glass p-6 rounded-xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white">Profile Information</h2>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    {isEditing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-blue-200 text-sm mb-2">First Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={profile.firstName}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    ) : (
                      <p className="text-white p-3 bg-white/5 rounded-lg">{profile.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-blue-200 text-sm mb-2">Last Name</label>
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={profile.lastName}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    ) : (
                      <p className="text-white p-3 bg-white/5 rounded-lg">{profile.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-blue-200 text-sm mb-2">Email</label>
                    <p className="text-white p-3 bg-white/5 rounded-lg">{profile.email}</p>
                    <p className="text-gray-400 text-xs mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-blue-200 text-sm mb-2">Role</label>
                    <p className="text-white p-3 bg-white/5 rounded-lg">{profile.role}</p>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-6 flex space-x-4">
                    <button
                      onClick={() => updateProfile({})}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6">
                {/* AI Preferences */}
                <div className="glass p-6 rounded-xl">
                  <h2 className="text-xl font-bold text-white mb-4">AI Preferences</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-blue-200 text-sm mb-2">Default Model</label>
                      <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gemini-pro">Gemini Pro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-blue-200 text-sm mb-2">Temperature</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        defaultValue={profile.preferences?.ai?.temperature || 0.7}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Focused</span>
                        <span>Creative</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-blue-200 text-sm mb-2">Max Tokens</label>
                      <input
                        type="number"
                        min="1"
                        max="4000"
                        defaultValue={profile.preferences?.ai?.maxTokens || 2000}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="streamResponses"
                        defaultChecked={profile.preferences?.ai?.streamResponses ?? true}
                        className="w-4 h-4"
                      />
                      <label htmlFor="streamResponses" className="text-white">
                        Stream responses
                      </label>
                    </div>
                  </div>
                </div>

                {/* General Preferences */}
                <div className="glass p-6 rounded-xl">
                  <h2 className="text-xl font-bold text-white mb-4">General</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-blue-200 text-sm mb-2">Theme</label>
                      <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-blue-200 text-sm mb-2">Language</label>
                      <select className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white">
                        <option value="en">English</option>
                        <option value="he">עברית</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'usage' && profile.usage && (
              <div className="space-y-6">
                {/* Current Plan */}
                <div className="glass p-6 rounded-xl">
                  <h2 className="text-xl font-bold text-white mb-4">Current Plan</h2>
                  
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white">{profile.usage.plan.name}</h3>
                      <p className="text-blue-200">
                        {formatTokens(profile.usage.monthlyTokens)} / {formatTokens(profile.usage.plan.tokenLimit)} tokens this month
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                      Upgrade Plan
                    </button>
                  </div>

                  {/* Usage Progress */}
                  <div className="mb-6">
                    <div className="w-full bg-white/10 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ 
                          width: `${Math.min((profile.usage.monthlyTokens / profile.usage.plan.tokenLimit) * 100, 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Plan Features */}
                  <div>
                    <h4 className="text-white font-medium mb-3">Plan Features</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {profile.usage.plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <span className="text-green-400">✓</span>
                          <span className="text-blue-200 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Usage Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass p-6 rounded-xl">
                    <h3 className="text-white font-medium mb-2">Total Tokens</h3>
                    <p className="text-3xl font-bold text-blue-400">
                      {formatTokens(profile.usage.totalTokens)}
                    </p>
                  </div>

                  <div className="glass p-6 rounded-xl">
                    <h3 className="text-white font-medium mb-2">Conversations</h3>
                    <p className="text-3xl font-bold text-purple-400">
                      {profile.usage.totalSessions}
                    </p>
                  </div>

                  <div className="glass p-6 rounded-xl">
                    <h3 className="text-white font-medium mb-2">Messages</h3>
                    <p className="text-3xl font-bold text-green-400">
                      {profile.usage.totalMessages}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="glass p-6 rounded-xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white">API Keys</h2>
                  <button
                    onClick={() => setShowApiModal(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Create API Key
                  </button>
                </div>

                {profile.apiKeys && profile.apiKeys.length > 0 ? (
                  <div className="space-y-4">
                    {profile.apiKeys.map((apiKey) => (
                      <div key={apiKey.id} className="p-4 bg-white/5 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-white font-medium">{apiKey.name}</h3>
                          <button
                            onClick={() => deleteApiKey(apiKey.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-2">
                          <code className="bg-black/30 px-3 py-1 rounded text-green-400 text-sm font-mono flex-1">
                            {apiKey.key}
                          </code>
                          <button
                            onClick={() => copyToClipboard(apiKey.key)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        
                        <div className="text-blue-200 text-xs">
                          Created: {new Date(apiKey.created).toLocaleDateString()}
                          {apiKey.lastUsed && (
                            <span className="ml-4">
                              Last used: {new Date(apiKey.lastUsed).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🔑</div>
                    <h3 className="text-xl font-semibold text-white mb-2">No API Keys</h3>
                    <p className="text-blue-200 mb-4">Create your first API key to access the platform programmatically</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create API Key Modal */}
        {showApiModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass p-6 rounded-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Create API Key</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newApiKeyName}
                    onChange={(e) => setNewApiKeyName(e.target.value)}
                    placeholder="My API Key"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-4">
                  <p className="text-yellow-200 text-sm">
                    ⚠️ Keep your API key secure and don&apos;t share it publicly. You&apos;ll only be able to see the full key once.
                  </p>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowApiModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createApiKey}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Create Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}