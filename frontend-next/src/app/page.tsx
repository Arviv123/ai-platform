'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  category: string;
}

export default function HomePage() {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [healthStatus, setHealthStatus] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [apiResponse, setApiResponse] = useState<string>('');

  const apiEndpoints: ApiEndpoint[] = [
    // Authentication
    { path: '/api/auth/register', method: 'POST', description: 'User Registration', category: 'Authentication' },
    { path: '/api/auth/login', method: 'POST', description: 'User Login', category: 'Authentication' },
    { path: '/api/auth/logout', method: 'POST', description: 'User Logout', category: 'Authentication' },
    
    // Security
    { path: '/api/security/mfa/setup', method: 'POST', description: 'Setup MFA', category: 'Security' },
    { path: '/api/security/mfa/enable', method: 'POST', description: 'Enable MFA', category: 'Security' },
    { path: '/api/security/password/change', method: 'POST', description: 'Change Password', category: 'Security' },
    
    // Organizations
    { path: '/api/organizations', method: 'GET', description: 'Get User Organizations', category: 'Organizations' },
    { path: '/api/organizations', method: 'POST', description: 'Create Organization', category: 'Organizations' },
    { path: '/api/organizations/:id/invitations', method: 'POST', description: 'Invite User', category: 'Organizations' },
    
    // MCP Servers
    { path: '/api/mcp', method: 'GET', description: 'Get MCP Servers', category: 'MCP' },
    { path: '/api/mcp', method: 'POST', description: 'Create MCP Server', category: 'MCP' },
    { path: '/api/mcp/:id/start', method: 'POST', description: 'Start MCP Server', category: 'MCP' },
    { path: '/api/mcp/:id/execute', method: 'POST', description: 'Execute MCP Tool', category: 'MCP' },
    
    // Gateway
    { path: '/api/gateway/stats', method: 'GET', description: 'Gateway Statistics', category: 'Gateway' },
    { path: '/api/gateway/health', method: 'GET', description: 'Services Health', category: 'Gateway' },
    
    // Monitoring
    { path: '/api/monitoring/metrics', method: 'GET', description: 'System Metrics', category: 'Monitoring' },
    { path: '/health', method: 'GET', description: 'Health Check', category: 'System' },
  ];

  const testEndpoint = async (endpoint: ApiEndpoint) => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:3005${endpoint.path}`, {
        method: endpoint.method,
        headers,
      });

      const data = await response.json();
      setApiResponse(JSON.stringify(data, null, 2));
      
      if (response.ok) {
        showToast(`✅ ${endpoint.path} - Success`, 'success');
      } else {
        showToast(`❌ ${endpoint.path} - ${response.status}`, 'error');
      }
    } catch (error) {
      setApiResponse(`Error: ${error}`);
      showToast(`❌ ${endpoint.path} - Network Error`, 'error');
    }
  };

  const checkHealth = async () => {
    try {
      const response = await fetch('http://localhost:3005/health');
      if (response.ok) {
        setHealthStatus('healthy');
        showToast('✅ Backend is healthy!', 'success');
      } else {
        setHealthStatus('error');
      }
    } catch (error) {
      setHealthStatus('error');
      showToast('❌ Backend connection failed', 'error');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const groupedEndpoints = apiEndpoints.reduce((acc, endpoint) => {
    if (!acc[endpoint.category]) {
      acc[endpoint.category] = [];
    }
    acc[endpoint.category].push(endpoint);
    return acc;
  }, {} as Record<string, ApiEndpoint[]>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🤖 <span className="gradient-text">AI Platform</span>
          </h1>
          <p className="text-blue-200 text-lg">
            Enterprise-Grade AI Management Platform
          </p>
          
          {/* Health Status */}
          <div className="mt-4 flex justify-center items-center space-x-4">
            <div 
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                healthStatus === 'healthy' ? 'status-healthy' : 
                healthStatus === 'error' ? 'status-error' : 
                'status-warning'
              }`}
            >
              {healthStatus === 'healthy' ? '🟢 Backend Healthy' : 
               healthStatus === 'error' ? '🔴 Backend Error' : 
               '🟡 Checking...'}
            </div>
            
            {isAuthenticated && (
              <div className="status-healthy">
                👤 Logged in as {user?.email}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {!isAuthenticated ? (
            <a 
              href="/auth/login" 
              className="glass p-6 rounded-xl text-center hover:bg-white/10 transition-colors"
            >
              <div className="text-2xl mb-2">🔐</div>
              <h3 className="text-white font-semibold mb-2">Authentication</h3>
              <p className="text-blue-200 text-sm">Login or Register</p>
            </a>
          ) : (
            <a 
              href="/chat" 
              className="glass p-6 rounded-xl text-center hover:bg-white/10 transition-colors"
            >
              <div className="text-2xl mb-2">🤖</div>
              <h3 className="text-white font-semibold mb-2">AI Chat</h3>
              <p className="text-blue-200 text-sm">Intelligent Conversations</p>
            </a>
          )}
          
          <a 
            href="/dashboard" 
            className="glass p-6 rounded-xl text-center hover:bg-white/10 transition-colors"
          >
            <div className="text-2xl mb-2">📊</div>
            <h3 className="text-white font-semibold mb-2">Dashboard</h3>
            <p className="text-blue-200 text-sm">Management Interface</p>
          </a>
          
          {isAuthenticated && (
            <a 
              href="/profile" 
              className="glass p-6 rounded-xl text-center hover:bg-white/10 transition-colors"
            >
              <div className="text-2xl mb-2">👤</div>
              <h3 className="text-white font-semibold mb-2">Profile</h3>
              <p className="text-blue-200 text-sm">Account Settings</p>
            </a>
          )}
          
          <button 
            onClick={() => window.open('http://localhost:3005/api/docs', '_blank')}
            className="glass p-6 rounded-xl text-center hover:bg-white/10 transition-colors"
          >
            <div className="text-2xl mb-2">📖</div>
            <h3 className="text-white font-semibold mb-2">API Docs</h3>
            <p className="text-blue-200 text-sm">Swagger Documentation</p>
          </button>
        </div>

        {/* API Endpoints */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Endpoints List */}
          <div className="glass p-6 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">🚀 API Endpoints</h2>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(groupedEndpoints).map(([category, endpoints]) => (
                <div key={category} className="space-y-2">
                  <h3 className="text-blue-300 font-semibold text-sm uppercase tracking-wide">
                    {category}
                  </h3>
                  {endpoints.map((endpoint, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`
                            px-2 py-1 text-xs font-mono rounded
                            ${endpoint.method === 'GET' ? 'bg-green-600' : 
                              endpoint.method === 'POST' ? 'bg-blue-600' : 
                              endpoint.method === 'PUT' ? 'bg-yellow-600' : 
                              'bg-red-600'}
                          `}>
                            {endpoint.method}
                          </span>
                          <code className="text-blue-200 text-sm">
                            {endpoint.path}
                          </code>
                        </div>
                        <p className="text-gray-300 text-xs mt-1">
                          {endpoint.description}
                        </p>
                      </div>
                      <button
                        onClick={() => testEndpoint(endpoint)}
                        className="ml-3 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                      >
                        Test
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Response Area */}
          <div className="glass p-6 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">📋 API Response</h2>
            <div className="bg-black/30 rounded-lg p-4 h-96 overflow-auto">
              <pre className="text-green-400 text-sm font-mono">
                {apiResponse || 'Click "Test" on any endpoint to see the response...'}
              </pre>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="mt-8 glass p-6 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-4">⚙️ System Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="text-blue-300 font-semibold mb-2">Backend</h3>
              <ul className="text-gray-300 space-y-1">
                <li>• Node.js + Express</li>
                <li>• Prisma ORM + SQLite</li>
                <li>• JWT Authentication</li>
                <li>• MFA Support</li>
                <li>• RBAC System</li>
              </ul>
            </div>
            <div>
              <h3 className="text-blue-300 font-semibold mb-2">Frontend</h3>
              <ul className="text-gray-300 space-y-1">
                <li>• Next.js 15</li>
                <li>• React 19</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS</li>
                <li>• Responsive Design</li>
              </ul>
            </div>
            <div>
              <h3 className="text-blue-300 font-semibold mb-2">Features</h3>
              <ul className="text-gray-300 space-y-1">
                <li>• MCP Server Management</li>
                <li>• Multi-tenancy</li>
                <li>• API Gateway</li>
                <li>• Real-time Monitoring</li>
                <li>• Enterprise Security</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
