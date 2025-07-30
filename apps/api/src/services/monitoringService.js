const os = require('os');
const logger = require('../utils/logger');

class MonitoringService {
  constructor() {
    this.metrics = {
      startTime: Date.now(),
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: new Map(),
        byStatus: new Map(),
        averageResponseTime: 0,
        responseTimeHistory: []
      },
      ai: {
        totalRequests: 0,
        totalTokens: 0,
        totalCreditsUsed: 0,
        modelUsage: new Map(),
        averageResponseTime: 0,
        errorRate: 0
      },
      users: {
        totalUsers: 0,
        activeUsers: new Set(),
        newUsersToday: 0,
        onlineUsers: new Set()
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIO: { rx: 0, tx: 0 },
        uptime: 0
      },
      database: {
        connections: 0,
        queries: 0,
        averageQueryTime: 0,
        slowQueries: 0
      },
      errors: {
        total: 0,
        byType: new Map(),
        recent: []
      }
    };
    
    this.alerts = [];
    this.thresholds = {
      cpuUsage: 80,
      memoryUsage: 85,
      responseTime: 5000,
      errorRate: 5,
      diskUsage: 90
    };

    // Start monitoring intervals
    this.startSystemMonitoring();
    this.startCleanupTasks();
  }

  // Record HTTP request metrics
  recordRequest(req, res, responseTime) {
    try {
      this.metrics.requests.total++;
      
      // Track by endpoint
      const endpoint = `${req.method} ${req.route?.path || req.path}`;
      const endpointCount = this.metrics.requests.byEndpoint.get(endpoint) || 0;
      this.metrics.requests.byEndpoint.set(endpoint, endpointCount + 1);
      
      // Track by status code
      const statusRange = `${Math.floor(res.statusCode / 100)}xx`;
      const statusCount = this.metrics.requests.byStatus.get(statusRange) || 0;
      this.metrics.requests.byStatus.set(statusRange, statusCount + 1);
      
      // Track success/failure
      if (res.statusCode < 400) {
        this.metrics.requests.successful++;
      } else {
        this.metrics.requests.failed++;
      }
      
      // Track response time
      this.metrics.requests.responseTimeHistory.push({
        time: Date.now(),
        duration: responseTime,
        endpoint: endpoint
      });
      
      // Keep only last 1000 entries
      if (this.metrics.requests.responseTimeHistory.length > 1000) {
        this.metrics.requests.responseTimeHistory = this.metrics.requests.responseTimeHistory.slice(-1000);
      }
      
      // Calculate average response time
      const recentTimes = this.metrics.requests.responseTimeHistory.slice(-100);
      this.metrics.requests.averageResponseTime = 
        recentTimes.reduce((sum, entry) => sum + entry.duration, 0) / recentTimes.length;

      // Check for alerts
      this.checkResponseTimeAlert(responseTime);
      
    } catch (error) {
      logger.error('Error recording request metrics:', error);
    }
  }

  // Record AI usage metrics
  recordAIUsage(model, tokens, credits, responseTime, success = true) {
    try {
      this.metrics.ai.totalRequests++;
      this.metrics.ai.totalTokens += tokens;
      this.metrics.ai.totalCreditsUsed += credits;
      
      // Track by model
      const modelStats = this.metrics.ai.modelUsage.get(model) || {
        requests: 0,
        tokens: 0,
        credits: 0,
        errors: 0,
        averageResponseTime: 0
      };
      
      modelStats.requests++;
      modelStats.tokens += tokens;
      modelStats.credits += credits;
      
      if (!success) {
        modelStats.errors++;
      }
      
      // Calculate model-specific average response time
      modelStats.averageResponseTime = 
        (modelStats.averageResponseTime * (modelStats.requests - 1) + responseTime) / modelStats.requests;
      
      this.metrics.ai.modelUsage.set(model, modelStats);
      
      // Calculate overall AI error rate
      const totalErrors = Array.from(this.metrics.ai.modelUsage.values())
        .reduce((sum, stats) => sum + stats.errors, 0);
      this.metrics.ai.errorRate = (totalErrors / this.metrics.ai.totalRequests) * 100;
      
    } catch (error) {
      logger.error('Error recording AI usage metrics:', error);
    }
  }

  // Record user activity
  recordUserActivity(userId, action) {
    try {
      this.metrics.users.activeUsers.add(userId);
      
      if (action === 'register') {
        this.metrics.users.totalUsers++;
        this.metrics.users.newUsersToday++;
      }
      
      if (action === 'online') {
        this.metrics.users.onlineUsers.add(userId);
      }
      
      if (action === 'offline') {
        this.metrics.users.onlineUsers.delete(userId);
      }
      
    } catch (error) {
      logger.error('Error recording user activity:', error);
    }
  }

  // Record database metrics
  recordDatabaseQuery(queryTime, isSlowQuery = false) {
    try {
      this.metrics.database.queries++;
      
      if (isSlowQuery) {
        this.metrics.database.slowQueries++;
      }
      
      // Calculate average query time
      this.metrics.database.averageQueryTime = 
        (this.metrics.database.averageQueryTime * (this.metrics.database.queries - 1) + queryTime) / 
        this.metrics.database.queries;
        
    } catch (error) {
      logger.error('Error recording database metrics:', error);
    }
  }

  // Record error metrics
  recordError(error, context = {}) {
    try {
      this.metrics.errors.total++;
      
      const errorType = error.name || 'UnknownError';
      const typeCount = this.metrics.errors.byType.get(errorType) || 0;
      this.metrics.errors.byType.set(errorType, typeCount + 1);
      
      // Store recent errors
      this.metrics.errors.recent.push({
        timestamp: new Date(),
        type: errorType,
        message: error.message,
        stack: error.stack,
        context: context
      });
      
      // Keep only last 100 errors
      if (this.metrics.errors.recent.length > 100) {
        this.metrics.errors.recent = this.metrics.errors.recent.slice(-100);
      }
      
      // Check for error rate alerts
      this.checkErrorRateAlert();
      
    } catch (err) {
      logger.error('Error recording error metrics:', err);
    }
  }

  // Start system monitoring
  startSystemMonitoring() {
    setInterval(() => {
      try {
        this.updateSystemMetrics();
      } catch (error) {
        logger.error('Error updating system metrics:', error);
      }
    }, 30000); // Every 30 seconds
  }

  // Update system metrics
  updateSystemMetrics() {
    try {
      // CPU usage
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      this.metrics.system.cpuUsage = ((totalTick - totalIdle) / totalTick) * 100;
      
      // Memory usage
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      this.metrics.system.memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
      
      // Uptime
      this.metrics.system.uptime = Date.now() - this.metrics.startTime;
      
      // Check for system alerts
      this.checkSystemAlerts();
      
    } catch (error) {
      logger.error('Error updating system metrics:', error);
    }
  }

  // Check for response time alerts
  checkResponseTimeAlert(responseTime) {
    if (responseTime > this.thresholds.responseTime) {
      this.createAlert('high_response_time', {
        message: `High response time detected: ${responseTime}ms`,
        threshold: this.thresholds.responseTime,
        actual: responseTime,
        severity: 'warning'
      });
    }
  }

  // Check for error rate alerts
  checkErrorRateAlert() {
    const errorRate = (this.metrics.requests.failed / this.metrics.requests.total) * 100;
    
    if (errorRate > this.thresholds.errorRate) {
      this.createAlert('high_error_rate', {
        message: `High error rate detected: ${errorRate.toFixed(2)}%`,
        threshold: this.thresholds.errorRate,
        actual: errorRate,
        severity: 'critical'
      });
    }
  }

  // Check for system alerts
  checkSystemAlerts() {
    // CPU usage alert
    if (this.metrics.system.cpuUsage > this.thresholds.cpuUsage) {
      this.createAlert('high_cpu_usage', {
        message: `High CPU usage: ${this.metrics.system.cpuUsage.toFixed(2)}%`,
        threshold: this.thresholds.cpuUsage,
        actual: this.metrics.system.cpuUsage,
        severity: 'warning'
      });
    }
    
    // Memory usage alert
    if (this.metrics.system.memoryUsage > this.thresholds.memoryUsage) {
      this.createAlert('high_memory_usage', {
        message: `High memory usage: ${this.metrics.system.memoryUsage.toFixed(2)}%`,
        threshold: this.thresholds.memoryUsage,
        actual: this.metrics.system.memoryUsage,
        severity: 'critical'
      });
    }
  }

  // Create alert
  createAlert(type, details) {
    try {
      const alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: type,
        timestamp: new Date(),
        details: details,
        acknowledged: false
      };
      
      this.alerts.push(alert);
      
      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100);
      }
      
      // Log alert
      logger.warn(`ALERT [${type}]: ${details.message}`, details);
      
      // Send notification (if configured)
      this.sendAlertNotification(alert);
      
    } catch (error) {
      logger.error('Error creating alert:', error);
    }
  }

  // Send alert notification
  async sendAlertNotification(alert) {
    try {
      // Here you could integrate with:
      // - Slack
      // - Discord
      // - PagerDuty
      // - Email
      // - SMS
      
      logger.info(`Alert notification sent for: ${alert.type}`);
      
    } catch (error) {
      logger.error('Error sending alert notification:', error);
    }
  }

  // Get current metrics
  getMetrics() {
    return {
      timestamp: new Date(),
      uptime: Date.now() - this.metrics.startTime,
      requests: {
        total: this.metrics.requests.total,
        successful: this.metrics.requests.successful,
        failed: this.metrics.requests.failed,
        successRate: this.metrics.requests.total > 0 ? 
          (this.metrics.requests.successful / this.metrics.requests.total) * 100 : 0,
        averageResponseTime: this.metrics.requests.averageResponseTime,
        topEndpoints: Array.from(this.metrics.requests.byEndpoint.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
      },
      ai: {
        totalRequests: this.metrics.ai.totalRequests,
        totalTokens: this.metrics.ai.totalTokens,
        totalCreditsUsed: this.metrics.ai.totalCreditsUsed,
        errorRate: this.metrics.ai.errorRate,
        modelUsage: Object.fromEntries(this.metrics.ai.modelUsage)
      },
      users: {
        totalUsers: this.metrics.users.totalUsers,
        activeUsers: this.metrics.users.activeUsers.size,
        onlineUsers: this.metrics.users.onlineUsers.size,
        newUsersToday: this.metrics.users.newUsersToday
      },
      system: {
        cpuUsage: this.metrics.system.cpuUsage,
        memoryUsage: this.metrics.system.memoryUsage,
        diskUsage: this.metrics.system.diskUsage,
        uptime: this.metrics.system.uptime
      },
      database: {
        queries: this.metrics.database.queries,
        averageQueryTime: this.metrics.database.averageQueryTime,
        slowQueries: this.metrics.database.slowQueries
      },
      errors: {
        total: this.metrics.errors.total,
        recent: this.metrics.errors.recent.slice(-10),
        byType: Object.fromEntries(
          Array.from(this.metrics.errors.byType.entries())
            .sort((a, b) => b[1] - a[1])
        )
      }
    };
  }

  // Get health status
  getHealthStatus() {
    const metrics = this.getMetrics();
    const health = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {}
    };

    // Check API health
    const errorRate = metrics.requests.total > 0 ? 
      ((metrics.requests.failed / metrics.requests.total) * 100) : 0;
    
    health.checks.api = {
      status: errorRate < this.thresholds.errorRate ? 'healthy' : 'unhealthy',
      errorRate: errorRate,
      averageResponseTime: metrics.requests.averageResponseTime
    };

    // Check system health
    health.checks.system = {
      status: (metrics.system.cpuUsage < this.thresholds.cpuUsage && 
               metrics.system.memoryUsage < this.thresholds.memoryUsage) ? 'healthy' : 'unhealthy',
      cpuUsage: metrics.system.cpuUsage,
      memoryUsage: metrics.system.memoryUsage
    };

    // Check AI services health
    health.checks.ai = {
      status: metrics.ai.errorRate < this.thresholds.errorRate ? 'healthy' : 'unhealthy',
      errorRate: metrics.ai.errorRate,
      totalRequests: metrics.ai.totalRequests
    };

    // Overall health status
    const unhealthyChecks = Object.values(health.checks).filter(check => check.status === 'unhealthy');
    if (unhealthyChecks.length > 0) {
      health.status = 'unhealthy';
    }

    return health;
  }

  // Get alerts
  getAlerts(acknowledged = false) {
    return this.alerts.filter(alert => alert.acknowledged === acknowledged);
  }

  // Acknowledge alert
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      return true;
    }
    return false;
  }

  // Start cleanup tasks
  startCleanupTasks() {
    // Clean up old metrics daily
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Reset daily counters
    setInterval(() => {
      this.resetDailyCounters();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  // Clean up old metrics
  cleanupOldMetrics() {
    try {
      // Clean up old response time history
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      this.metrics.requests.responseTimeHistory = 
        this.metrics.requests.responseTimeHistory.filter(entry => entry.time > cutoff);

      // Clean up old errors
      this.metrics.errors.recent = 
        this.metrics.errors.recent.filter(error => 
          (Date.now() - error.timestamp.getTime()) < (24 * 60 * 60 * 1000)
        );

      logger.info('Old metrics cleaned up');
    } catch (error) {
      logger.error('Error cleaning up old metrics:', error);
    }
  }

  // Reset daily counters
  resetDailyCounters() {
    try {
      this.metrics.users.newUsersToday = 0;
      this.metrics.users.activeUsers.clear();
      
      logger.info('Daily counters reset');
    } catch (error) {
      logger.error('Error resetting daily counters:', error);
    }
  }

  // Export metrics for external monitoring systems
  exportMetrics(format = 'json') {
    const metrics = this.getMetrics();
    
    switch (format) {
      case 'prometheus':
        return this.formatPrometheusMetrics(metrics);
      case 'json':
      default:
        return metrics;
    }
  }

  // Format metrics for Prometheus
  formatPrometheusMetrics(metrics) {
    let output = '';
    
    // HTTP requests
    output += `http_requests_total ${metrics.requests.total}\n`;
    output += `http_requests_successful ${metrics.requests.successful}\n`;
    output += `http_requests_failed ${metrics.requests.failed}\n`;
    output += `http_response_time_avg ${metrics.requests.averageResponseTime}\n`;
    
    // AI metrics
    output += `ai_requests_total ${metrics.ai.totalRequests}\n`;
    output += `ai_tokens_total ${metrics.ai.totalTokens}\n`;
    output += `ai_credits_used_total ${metrics.ai.totalCreditsUsed}\n`;
    output += `ai_error_rate ${metrics.ai.errorRate}\n`;
    
    // System metrics
    output += `system_cpu_usage ${metrics.system.cpuUsage}\n`;
    output += `system_memory_usage ${metrics.system.memoryUsage}\n`;
    output += `system_uptime ${metrics.system.uptime}\n`;
    
    // User metrics
    output += `users_total ${metrics.users.totalUsers}\n`;
    output += `users_active ${metrics.users.activeUsers}\n`;
    output += `users_online ${metrics.users.onlineUsers}\n`;
    
    return output;
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;