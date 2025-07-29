'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    inbound: number;
    outbound: number;
  };
  uptime: number;
}

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  lastCheck: string;
}

interface RequestMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  requestsPerSecond: number;
  topEndpoints: Array<{
    path: string;
    count: number;
    avgTime: number;
  }>;
}

export default function MonitoringPage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<RequestMetrics | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (isAuthenticated) {
      loadMonitoringData();
      
      // Set up auto-refresh every 30 seconds
      const interval = setInterval(loadMonitoringData, 30000);
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [isAuthenticated, isLoading, router]);

  const loadMonitoringData = async () => {
    setIsLoadingData(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      // Load system metrics
      const metricsResponse = await fetch('http://localhost:3005/api/monitoring/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setSystemMetrics(metricsData.data);
      }

      // Load service health
      const healthResponse = await fetch('http://localhost:3005/api/gateway/health', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setServiceHealth(healthData.data || []);
      }

      // Load request metrics
      const requestsResponse = await fetch('http://localhost:3005/api/monitoring/requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setRequestMetrics(requestsData.data);
      }

    } catch (error) {
      console.error('Failed to load monitoring data:', error);
      showToast('Failed to load monitoring data', 'error');
    } finally {
      setIsLoadingData(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getMetricColor = (value: number, thresholds: { warning: number; error: number }) => {
    if (value >= thresholds.error) return 'text-red-400';
    if (value >= thresholds.warning) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'status-healthy';
      case 'warning': return 'status-warning';
      case 'error': return 'status-error';
      default: return 'status-inactive';
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
              📈 System Monitoring
            </h1>
            <p className="text-blue-200">
              Real-time system metrics and health monitoring
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isLoadingData ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
              <span className="text-blue-200 text-sm">
                {isLoadingData ? 'Updating...' : 'Live'}
              </span>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="glass px-4 py-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* System Metrics */}
        {systemMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">CPU Usage</h3>
                <span className="text-2xl">🖥️</span>
              </div>
              <div className="space-y-2">
                <div className={`text-2xl font-bold ${getMetricColor(systemMetrics.cpu, { warning: 70, error: 90 })}`}>
                  {systemMetrics.cpu.toFixed(1)}%
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      systemMetrics.cpu >= 90 ? 'bg-red-500' :
                      systemMetrics.cpu >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${systemMetrics.cpu}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Memory Usage</h3>
                <span className="text-2xl">💾</span>
              </div>
              <div className="space-y-2">
                <div className={`text-2xl font-bold ${getMetricColor(systemMetrics.memory, { warning: 80, error: 95 })}`}>
                  {systemMetrics.memory.toFixed(1)}%
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      systemMetrics.memory >= 95 ? 'bg-red-500' :
                      systemMetrics.memory >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${systemMetrics.memory}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Disk Usage</h3>
                <span className="text-2xl">💽</span>
              </div>
              <div className="space-y-2">
                <div className={`text-2xl font-bold ${getMetricColor(systemMetrics.disk, { warning: 85, error: 95 })}`}>
                  {systemMetrics.disk.toFixed(1)}%
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      systemMetrics.disk >= 95 ? 'bg-red-500' :
                      systemMetrics.disk >= 85 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${systemMetrics.disk}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Uptime</h3>
                <span className="text-2xl">⏱️</span>
              </div>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-green-400">
                  {formatUptime(systemMetrics.uptime)}
                </div>
                <div className="text-blue-200 text-sm">
                  Running smoothly
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Service Health */}
          <div className="glass p-6 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">🏥 Service Health</h2>
            
            {serviceHealth.length > 0 ? (
              <div className="space-y-3">
                {serviceHealth.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">
                        {service.status === 'healthy' ? '🟢' :
                         service.status === 'warning' ? '🟡' : '🔴'}
                      </span>
                      <div>
                        <h3 className="text-white font-medium">{service.service}</h3>
                        <p className="text-blue-200 text-sm">
                          Response: {service.responseTime}ms
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                        {service.status}
                      </span>
                      <p className="text-blue-200 text-xs mt-1">
                        {new Date(service.lastCheck).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🏥</div>
                <p className="text-blue-200">No service health data available</p>
              </div>
            )}
          </div>

          {/* Request Metrics */}
          <div className="glass p-6 rounded-xl">
            <h2 className="text-xl font-bold text-white mb-4">📊 Request Metrics</h2>
            
            {requestMetrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-blue-200 text-sm">Total Requests</p>
                    <p className="text-2xl font-bold text-white">
                      {requestMetrics.totalRequests.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Success Rate</p>
                    <p className="text-2xl font-bold text-green-400">
                      {requestMetrics.successRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Avg Response Time</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {requestMetrics.averageResponseTime}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Requests/sec</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {requestMetrics.requestsPerSecond.toFixed(1)}
                    </p>
                  </div>
                </div>

                {requestMetrics.topEndpoints && requestMetrics.topEndpoints.length > 0 && (
                  <div>
                    <h3 className="text-white font-medium mb-3">Top Endpoints</h3>
                    <div className="space-y-2">
                      {requestMetrics.topEndpoints.slice(0, 5).map((endpoint, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-white/5 rounded">
                          <div>
                            <code className="text-blue-200 text-sm">{endpoint.path}</code>
                            <p className="text-gray-400 text-xs">{endpoint.count} requests</p>
                          </div>
                          <div className="text-right">
                            <p className="text-white text-sm">{endpoint.avgTime}ms</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-blue-200">No request metrics available</p>
              </div>
            )}
          </div>
        </div>

        {/* Network Usage */}
        {systemMetrics?.network && (
          <div className="glass p-6 rounded-xl mt-8">
            <h2 className="text-xl font-bold text-white mb-4">🌐 Network Usage</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-white font-medium mb-2">Inbound Traffic</h3>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold text-green-400">
                    {formatBytes(systemMetrics.network.inbound)}/s
                  </div>
                  <div className="text-green-400">↓</div>
                </div>
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Outbound Traffic</h3>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold text-blue-400">
                    {formatBytes(systemMetrics.network.outbound)}/s
                  </div>
                  <div className="text-blue-400">↑</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}