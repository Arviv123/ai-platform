const express = require('express');
const monitoringService = require('../services/monitoringService');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/monitoring/metrics:
 *   get:
 *     summary: Get system metrics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: System metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                 requests:
 *                   type: object
 *                 ai:
 *                   type: object
 *                 users:
 *                   type: object
 *                 system:
 *                   type: object
 */
router.get('/metrics', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const metrics = monitoringService.exportMetrics(format);
    
    if (format === 'prometheus') {
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } else {
      res.json({
        status: 'success',
        data: metrics
      });
    }
  } catch (error) {
    logger.error('Error retrieving metrics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve metrics'
    });
  }
});

/**
 * @swagger
 * /api/monitoring/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 *       503:
 *         description: System is unhealthy
 */
router.get('/health', (req, res) => {
  try {
    const health = monitoringService.getHealthStatus();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status: health.status,
      timestamp: health.timestamp,
      checks: health.checks
    });
  } catch (error) {
    logger.error('Error retrieving health status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve health status'
    });
  }
});

/**
 * @swagger
 * /api/monitoring/alerts:
 *   get:
 *     summary: Get system alerts
 *     tags: [Monitoring]
 *     parameters:
 *       - in: query
 *         name: acknowledged
 *         schema:
 *           type: boolean
 *         description: Filter by acknowledgment status
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
 */
router.get('/alerts', (req, res) => {
  try {
    const acknowledged = req.query.acknowledged === 'true';
    const alerts = monitoringService.getAlerts(acknowledged);
    
    res.json({
      status: 'success',
      data: {
        alerts: alerts,
        total: alerts.length
      }
    });
  } catch (error) {
    logger.error('Error retrieving alerts:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve alerts'
    });
  }
});

/**
 * @swagger
 * /api/monitoring/alerts/{alertId}/acknowledge:
 *   post:
 *     summary: Acknowledge an alert
 *     tags: [Monitoring]
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 *       404:
 *         description: Alert not found
 */
router.post('/alerts/:alertId/acknowledge', (req, res) => {
  try {
    const alertId = req.params.alertId;
    const acknowledged = monitoringService.acknowledgeAlert(alertId);
    
    if (acknowledged) {
      res.json({
        status: 'success',
        message: 'Alert acknowledged successfully'
      });
    } else {
      res.status(404).json({
        status: 'fail',
        message: 'Alert not found'
      });
    }
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to acknowledge alert'
    });
  }
});

/**
 * @swagger
 * /api/monitoring/stats:
 *   get:
 *     summary: Get detailed system statistics
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/stats', (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    const health = monitoringService.getHealthStatus();
    const alerts = monitoringService.getAlerts();
    
    const stats = {
      overview: {
        status: health.status,
        uptime: metrics.uptime,
        totalRequests: metrics.requests.total,
        activeUsers: metrics.users.activeUsers,
        onlineUsers: metrics.users.onlineUsers
      },
      performance: {
        averageResponseTime: metrics.requests.averageResponseTime,
        successRate: metrics.requests.successRate,
        cpuUsage: metrics.system.cpuUsage,
        memoryUsage: metrics.system.memoryUsage
      },
      ai: {
        totalRequests: metrics.ai.totalRequests,
        totalTokens: metrics.ai.totalTokens,
        totalCreditsUsed: metrics.ai.totalCreditsUsed,
        errorRate: metrics.ai.errorRate,
        modelUsage: metrics.ai.modelUsage
      },
      alerts: {
        total: alerts.length,
        unacknowledged: alerts.filter(a => !a.acknowledged).length,
        recent: alerts.slice(-5)
      }
    };
    
    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    logger.error('Error retrieving statistics:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve statistics'
    });
  }
});

/**
 * @swagger
 * /api/monitoring/dashboard:
 *   get:
 *     summary: Get dashboard data for admin interface
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 */
router.get('/dashboard', (req, res) => {
  try {
    const metrics = monitoringService.getMetrics();
    const health = monitoringService.getHealthStatus();
    const alerts = monitoringService.getAlerts();
    
    // Calculate additional dashboard metrics
    const now = Date.now();
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    
    // Requests per hour for last 24 hours
    const requestsPerHour = [];
    for (let i = 23; i >= 0; i--) {
      const hourStart = now - (i * hour);
      const hourEnd = hourStart + hour;
      
      const hourlyRequests = metrics.requests.total; // Simplified for demo
      requestsPerHour.push({
        hour: new Date(hourStart).getHours(),
        requests: Math.floor(Math.random() * 100) + 50 // Demo data
      });
    }
    
    // Top endpoints
    const topEndpoints = metrics.requests.topEndpoints.map(([endpoint, count]) => ({
      endpoint,
      count,
      percentage: (count / metrics.requests.total) * 100
    }));
    
    // Error distribution
    const errorDistribution = Object.entries(metrics.errors.byType).map(([type, count]) => ({
      type,
      count,
      percentage: (count / metrics.errors.total) * 100
    }));
    
    const dashboard = {
      summary: {
        status: health.status,
        uptime: metrics.uptime,
        totalUsers: metrics.users.totalUsers,
        activeUsers: metrics.users.activeUsers,
        onlineUsers: metrics.users.onlineUsers,
        totalRequests: metrics.requests.total,
        successRate: metrics.requests.successRate,
        errorRate: (metrics.requests.failed / metrics.requests.total) * 100,
        averageResponseTime: metrics.requests.averageResponseTime
      },
      charts: {
        requestsPerHour,
        topEndpoints: topEndpoints.slice(0, 10),
        errorDistribution: errorDistribution.slice(0, 10),
        modelUsage: Object.entries(metrics.ai.modelUsage).map(([model, stats]) => ({
          model,
          requests: stats.requests,
          tokens: stats.tokens,
          credits: stats.credits
        }))
      },
      system: {
        cpuUsage: metrics.system.cpuUsage,
        memoryUsage: metrics.system.memoryUsage,
        diskUsage: metrics.system.diskUsage,
        uptime: metrics.system.uptime
      },
      alerts: {
        total: alerts.length,
        critical: alerts.filter(a => a.details.severity === 'critical').length,
        warning: alerts.filter(a => a.details.severity === 'warning').length,
        unacknowledged: alerts.filter(a => !a.acknowledged).length,
        recent: alerts.slice(-10)
      },
      database: {
        queries: metrics.database.queries,
        averageQueryTime: metrics.database.averageQueryTime,
        slowQueries: metrics.database.slowQueries
      }
    };
    
    res.json({
      status: 'success',
      data: dashboard
    });
  } catch (error) {
    logger.error('Error retrieving dashboard data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve dashboard data'
    });
  }
});

module.exports = router;