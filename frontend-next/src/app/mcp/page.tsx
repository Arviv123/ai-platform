'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiHelpers } from '@/lib/api';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  enabled: boolean;
  healthStatus: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
  totalCalls: number;
  lastUsedAt: string;
  createdAt: string;
}

interface MCPTool {
  name: string;
  description: string;
  parameters: any;
}

export default function MCPPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoadingServers, setIsLoadingServers] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [availableTools, setAvailableTools] = useState<MCPTool[]>([]);
  
  const [newServer, setNewServer] = useState({
    name: '',
    description: '',
    command: '',
    args: ''
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      loadServers();
    }
  }, [isAuthenticated, isLoading, router]);

  const loadServers = async () => {
    try {
      setIsLoadingServers(true);
      
      // Mock data - replace with real API call
      const mockServers: MCPServer[] = [
        {
          id: '1',
          name: 'Weather Server',
          description: 'Provides weather information and forecasts',
          command: 'python',
          args: ['weather_mcp.py'],
          enabled: true,
          healthStatus: 'HEALTHY',
          totalCalls: 245,                                                       
          lastUsedAt: '2025-07-28T20:00:00Z',
          createdAt: '2025-07-20T10:00:00Z'
        },
        {
          id: '2',
          name: 'Database Tools',
          description: 'Database query and management tools',
          command: 'node',
          args: ['db_mcp.js'],
          enabled: false,
          healthStatus: 'UNKNOWN',
          totalCalls: 0,
          lastUsedAt: '',
          createdAt: '2025-07-25T15:30:00Z'
        },
        {
          id: '3',
          name: 'File System',
          description: 'File operations and management',
          command: './fs_server',
          args: ['--port', '8080'],
          enabled: true,
          healthStatus: 'HEALTHY',
          totalCalls: 89,
          lastUsedAt: '2025-07-28T19:45:00Z',
          createdAt: '2025-07-22T14:20:00Z'
        }
      ];
      
      setServers(mockServers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      showToast('Failed to load MCP servers', 'error');
    } finally {
      setIsLoadingServers(false);
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.command) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      // Parse args from string
      const args = newServer.args ? newServer.args.split(' ').filter(arg => arg.trim()) : [];
      
      const serverData = {
        ...newServer,
        args
      };

      // Mock API call
      console.log('Adding server:', serverData);
      showToast('MCP Server added successfully!', 'success');
      
      setShowAddModal(false);
      setNewServer({ name: '', description: '', command: '', args: '' });
      loadServers();
    } catch (error) {
      console.error('Failed to add MCP server:', error);
      showToast('Failed to add MCP server', 'error');
    }
  };

  const toggleServer = async (serverId: string, enabled: boolean) => {
    try {
      // Mock API call
      console.log(`${enabled ? 'Enabling' : 'Disabling'} server:`, serverId);
      
      setServers(prev => prev.map(server => 
        server.id === serverId ? { ...server, enabled } : server
      ));
      
      showToast(`Server ${enabled ? 'enabled' : 'disabled'} successfully`, 'success');
    } catch (error) {
      console.error('Failed to toggle server:', error);
      showToast('Failed to toggle server', 'error');
    }
  };

  const testServer = async (serverId: string) => {
    try {
      showToast('Testing server connection...', 'info');
      
      // Mock API call
      setTimeout(() => {
        setServers(prev => prev.map(server => 
          server.id === serverId ? { ...server, healthStatus: 'HEALTHY' as const } : server
        ));
        showToast('Server connection test successful!', 'success');
      }, 2000);
    } catch (error) {
      console.error('Failed to test server:', error);
      showToast('Server test failed', 'error');
    }
  };

  const deleteServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this server?')) {
      return;
    }

    try {
      // Mock API call
      console.log('Deleting server:', serverId);
      setServers(prev => prev.filter(server => server.id !== serverId));
      showToast('Server deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete server:', error);
      showToast('Failed to delete server', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY': return 'text-green-400';
      case 'UNHEALTHY': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY': return '🟢';
      case 'UNHEALTHY': return '🔴';
      default: return '🟡';
    }
  };

  if (isLoading || isLoadingServers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="spinner"></div>
          <span className="text-white">Loading MCP servers...</span>
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
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">🔌 MCP Servers</h1>
              <p className="text-blue-200">ניהול שרתי Model Context Protocol</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                ← חזור לדשבורד
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                ➕ הוסף שרת חדש
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">סך הכל שרתים</p>
                <p className="text-3xl font-bold text-white">{servers.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🔌</span>
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">שרתים פעילים</p>
                <p className="text-3xl font-bold text-white">
                  {servers.filter(s => s.enabled).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">שרתים בריאים</p>
                <p className="text-3xl font-bold text-white">
                  {servers.filter(s => s.healthStatus === 'HEALTHY').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">💚</span>
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-sm">סך קריאות</p>
                <p className="text-3xl font-bold text-white">
                  {servers.reduce((sum, s) => sum + s.totalCalls, 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>
        </div>

        {/* Servers List */}
        <div className="glass p-6 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">שרתי MCP</h2>
            <div className="flex space-x-2">
              <button
                onClick={loadServers}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                🔄 רענן
              </button>
            </div>
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔌</div>
              <h3 className="text-xl font-semibold text-white mb-2">אין שרתי MCP</h3>
              <p className="text-blue-200 mb-4">התחל על ידי הוספת השרת הראשון שלך</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                הוסף שרת ראשון
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map((server) => (
                <div key={server.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                        <span className={`text-sm ${getStatusColor(server.healthStatus)}`}>
                          {getStatusIcon(server.healthStatus)} {server.healthStatus}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          server.enabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-white'
                        }`}>
                          {server.enabled ? 'פעיל' : 'לא פעיל'}
                        </span>
                      </div>
                      <p className="text-blue-200 text-sm mt-1">{server.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-blue-200">
                        <span>📞 {server.totalCalls} קריאות</span>
                        <span>⏰ שימוש אחרון: {formatDate(server.lastUsedAt)}</span>
                        <span>📅 נוצר: {formatDate(server.createdAt)}</span>
                      </div>
                      <div className="mt-2 font-mono text-xs text-gray-400">
                        {server.command} {server.args.join(' ')}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => testServer(server.id)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
                        title="Test server connection"
                      >
                        🧪
                      </button>
                      <button
                        onClick={() => toggleServer(server.id, !server.enabled)}
                        className={`px-3 py-1 text-white text-sm rounded transition-colors ${
                          server.enabled 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                        title={server.enabled ? 'Disable server' : 'Enable server'}
                      >
                        {server.enabled ? '⏸️' : '▶️'}
                      </button>
                      <button
                        onClick={() => setSelectedServer(server)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        title="Edit server"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteServer(server.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                        title="Delete server"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass p-6 rounded-xl w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-white mb-4">הוסף שרת MCP חדש</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  שם השרת *
                </label>
                <input
                  type="text"
                  value={newServer.name}
                  onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Weather Server"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  תיאור
                </label>
                <input
                  type="text"
                  value={newServer.description}
                  onChange={(e) => setNewServer(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="תיאור קצר של השרת"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  פקודה *
                </label>
                <input
                  type="text"
                  value={newServer.command}
                  onChange={(e) => setNewServer(prev => ({ ...prev, command: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., python, node, ./server"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">
                  ארגומנטים
                </label>
                <input
                  type="text"
                  value={newServer.args}
                  onChange={(e) => setNewServer(prev => ({ ...prev, args: e.target.value }))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., server.py --port 8080"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleAddServer}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                הוסף שרת
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}