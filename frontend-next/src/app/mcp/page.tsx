'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface MCPServer {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  url: string;
  tools: string[];
  lastActive: string;
  cpuUsage?: number;
  memoryUsage?: number;
}

export default function MCPPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    type: 'docker'
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
    setIsLoadingData(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/mcp', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setServers(data.data || []);
      } else {
        showToast('Failed to load MCP servers', 'error');
      }
    } catch (error) {
      console.error('Failed to load servers:', error);
      showToast('Network error loading servers', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('http://localhost:3005/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newServer)
      });

      if (response.ok) {
        showToast('MCP server created successfully!', 'success');
        setShowCreateModal(false);
        setNewServer({ name: '', url: '', type: 'docker' });
        loadServers();
      } else {
        const data = await response.json();
        showToast(data.message || 'Failed to create server', 'error');
      }
    } catch (error) {
      showToast('Network error creating server', 'error');
    }
  };

  const handleServerAction = async (serverId: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`http://localhost:3005/api/mcp/${serverId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        showToast(`Server ${action}ed successfully!`, 'success');
        loadServers();
      } else {
        showToast(`Failed to ${action} server`, 'error');
      }
    } catch (error) {
      showToast(`Network error ${action}ing server`, 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'stopped': return 'text-gray-400';
      case 'error': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return '🟢';
      case 'stopped': return '⚫';
      case 'error': return '🔴';
      default: return '🟡';
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
              🤖 MCP Servers
            </h1>
            <p className="text-blue-200">
              Manage your Model Context Protocol servers
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              ➕ Create Server
            </button>
          </div>
        </div>

        {/* Servers Grid */}
        {isLoadingData ? (
          <div className="flex justify-center items-center h-64">
            <div className="spinner"></div>
          </div>
        ) : servers.length === 0 ? (
          <div className="glass p-8 rounded-xl text-center">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-white mb-2">No MCP Servers</h3>
            <p className="text-blue-200 mb-4">Create your first MCP server to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Server
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {servers.map((server) => (
              <div key={server.id} className="glass p-6 rounded-xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                    <p className="text-blue-200 text-sm">{server.url}</p>
                  </div>
                  <div className={`flex items-center space-x-1 ${getStatusColor(server.status)}`}>
                    <span>{getStatusIcon(server.status)}</span>
                    <span className="text-sm font-medium capitalize">{server.status}</span>
                  </div>
                </div>

                {/* Server Stats */}
                {server.status === 'running' && (
                  <div className="mb-4 space-y-2">
                    {server.cpuUsage !== undefined && (
                      <div>
                        <div className="flex justify-between text-sm text-blue-200 mb-1">
                          <span>CPU Usage</span>
                          <span>{server.cpuUsage}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${server.cpuUsage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {server.memoryUsage !== undefined && (
                      <div>
                        <div className="flex justify-between text-sm text-blue-200 mb-1">
                          <span>Memory Usage</span>
                          <span>{server.memoryUsage}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${server.memoryUsage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tools */}
                {server.tools && server.tools.length > 0 && (
                  <div className="mb-4">
                    <p className="text-blue-200 text-sm mb-2">Available Tools:</p>
                    <div className="flex flex-wrap gap-1">
                      {server.tools.slice(0, 3).map((tool, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-blue-600/30 text-blue-200 text-xs rounded"
                        >
                          {tool}
                        </span>
                      ))}
                      {server.tools.length > 3 && (
                        <span className="px-2 py-1 bg-gray-600/30 text-gray-300 text-xs rounded">
                          +{server.tools.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Last Active */}
                <p className="text-blue-200 text-xs mb-4">
                  Last active: {new Date(server.lastActive).toLocaleString()}
                </p>

                {/* Actions */}
                <div className="flex space-x-2">
                  {server.status === 'running' ? (
                    <>
                      <button
                        onClick={() => handleServerAction(server.id, 'stop')}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                      >
                        Stop
                      </button>
                      <button
                        onClick={() => handleServerAction(server.id, 'restart')}
                        className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
                      >
                        Restart
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleServerAction(server.id, 'start')}
                      className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                    >
                      Start
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/mcp/${server.id}`)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Server Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass p-6 rounded-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-4">Create MCP Server</h2>
              
              <form onSubmit={handleCreateServer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Server Name
                  </label>
                  <input
                    type="text"
                    value={newServer.name}
                    onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="My MCP Server"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Server URL
                  </label>
                  <input
                    type="url"
                    value={newServer.url}
                    onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="http://localhost:8080"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">
                    Server Type
                  </label>
                  <select
                    value={newServer.type}
                    onChange={(e) => setNewServer({ ...newServer, type: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="docker">Docker Container</option>
                    <option value="process">Local Process</option>
                    <option value="remote">Remote Server</option>
                  </select>
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
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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