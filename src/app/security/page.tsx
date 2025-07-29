'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SecuritySettings {
  mfaEnabled: boolean;
  mfaSetup: boolean;
  lastPasswordChange: string;
  loginSessions: number;
  securityEvents: SecurityEvent[];
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'logout' | 'password_change' | 'mfa_enable' | 'mfa_disable';
  timestamp: string;
  ip: string;
  userAgent: string;
}

export default function SecurityPage() {
  const { isAuthenticated, user, isLoading, refreshAuth } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      loadSecuritySettings();
    }
  }, [isAuthenticated, isLoading, router]);

  const loadSecuritySettings = async () => {
    setIsLoadingData(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/security/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
      } else {
        showToast('Failed to load security settings', 'error');
      }
    } catch (error) {
      console.error('Failed to load security settings:', error);
      showToast('Network error loading security settings', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/security/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      if (response.ok) {
        showToast('Password changed successfully!', 'success');
        setShowPasswordModal(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        loadSecuritySettings();
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to change password', 'error');
      }
    } catch (error) {
      showToast('Network error changing password', 'error');
    }
  };

  const setupMfa = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/security/mfa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMfaQrCode(data.qrCode);
        setShowMfaModal(true);
      } else {
        showToast('Failed to setup MFA', 'error');
      }
    } catch (error) {
      showToast('Network error setting up MFA', 'error');
    }
  };

  const enableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/security/mfa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token: mfaToken })
      });

      if (response.ok) {
        showToast('MFA enabled successfully!', 'success');
        setShowMfaModal(false);
        setMfaToken('');
        setMfaQrCode('');
        loadSecuritySettings();
        refreshAuth();
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to enable MFA', 'error');
      }
    } catch (error) {
      showToast('Network error enabling MFA', 'error');
    }
  };

  const disableMfa = async () => {
    if (!confirm('Are you sure you want to disable MFA? This will make your account less secure.')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/security/mfa/disable', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        showToast('MFA disabled', 'warning');
        loadSecuritySettings();
        refreshAuth();
      } else {
        showToast('Failed to disable MFA', 'error');
      }
    } catch (error) {
      showToast('Network error disabling MFA', 'error');
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'login': return '🔐';
      case 'logout': return '🚪';
      case 'password_change': return '🔑';
      case 'mfa_enable': return '🛡️';
      case 'mfa_disable': return '⚠️';
      default: return '📝';
    }
  };

  const getEventTypeText = (type: string) => {
    switch (type) {
      case 'login': return 'Login';
      case 'logout': return 'Logout';
      case 'password_change': return 'Password Change';
      case 'mfa_enable': return 'MFA Enabled';
      case 'mfa_disable': return 'MFA Disabled';
      default: return type;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              🔐 Security Settings
            </h1>
            <p className="text-blue-200">
              Manage your account security and privacy
            </p>
          </div>
          
          <button
            onClick={() => router.push('/dashboard')}
            className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          >
            ← Dashboard
          </button>
        </div>

        {isLoadingData ? (
          <div className="flex justify-center items-center h-64">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Security Settings */}
            <div className="space-y-6">
              {/* Account Security */}
              <div className="glass p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4">🛡️ Account Security</h2>
                
                <div className="space-y-4">
                  {/* MFA */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-medium">Multi-Factor Authentication</h3>
                      <p className="text-blue-200 text-sm">
                        {user?.mfaEnabled ? 'MFA is enabled' : 'Add an extra layer of security'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        user?.mfaEnabled ? 'status-healthy' : 'status-warning'
                      }`}>
                        {user?.mfaEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {user?.mfaEnabled ? (
                        <button
                          onClick={disableMfa}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={setupMfa}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-medium">Password</h3>
                      <p className="text-blue-200 text-sm">
                        {settings?.lastPasswordChange 
                          ? `Last changed: ${new Date(settings.lastPasswordChange).toLocaleDateString()}`
                          : 'Manage your account password'
                        }
                      </p>
                    </div>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                    >
                      Change
                    </button>
                  </div>

                  {/* Active Sessions */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-white font-medium">Active Sessions</h3>
                      <p className="text-blue-200 text-sm">
                        {settings?.loginSessions || 0} active login sessions
                      </p>
                    </div>
                    <button className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded transition-colors">
                      Manage
                    </button>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="glass p-6 rounded-xl">
                <h2 className="text-xl font-bold text-white mb-4">👤 Account Information</h2>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-blue-200 text-sm">Email</label>
                    <p className="text-white">{user?.email}</p>
                  </div>
                  
                  <div>
                    <label className="block text-blue-200 text-sm">Name</label>
                    <p className="text-white">{user?.firstName} {user?.lastName}</p>
                  </div>
                  
                  <div>
                    <label className="block text-blue-200 text-sm">Role</label>
                    <span className="px-2 py-1 bg-blue-600/30 text-blue-200 text-xs rounded">
                      {user?.role}
                    </span>
                  </div>
                  
                  {user?.organizationId && (
                    <div>
                      <label className="block text-blue-200 text-sm">Organization</label>
                      <p className="text-white">{user.organizationId}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Security Events */}
            <div className="glass p-6 rounded-xl">
              <h2 className="text-xl font-bold text-white mb-4">📋 Security Events</h2>
              
              {settings?.securityEvents && settings.securityEvents.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {settings.securityEvents.map((event) => (
                    <div key={event.id} className="bg-white/5 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getEventTypeIcon(event.type)}</span>
                          <span className="text-white font-medium">
                            {getEventTypeText(event.type)}
                          </span>
                        </div>
                        <span className="text-blue-200 text-xs">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-blue-200 text-sm">
                        <div>IP: {event.ip}</div>
                        <div className="truncate">Agent: {event.userAgent}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">📋</div>
                  <p className="text-blue-200">No security events recorded</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass p-6 rounded-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Change Password</h2>
              
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MFA Setup Modal */}
        {showMfaModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass p-6 rounded-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Setup Multi-Factor Authentication</h2>
              
              <div className="text-center mb-6">
                <p className="text-blue-200 mb-4">
                  Scan this QR code with your authenticator app:
                </p>
                {mfaQrCode && (
                  <div className="bg-white p-4 rounded-lg inline-block">
                    <img src={mfaQrCode} alt="MFA QR Code" className="w-48 h-48" />
                  </div>
                )}
              </div>
              
              <form onSubmit={enableMfa} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Enter 6-digit code from your app
                  </label>
                  <input
                    type="text"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value)}
                    required
                    maxLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg"
                    placeholder="000000"
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowMfaModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    Enable MFA
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