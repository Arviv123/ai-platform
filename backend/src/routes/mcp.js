const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requirePermission, requireResourceOwnership } = require('../middleware/rbac');
const { securityLimiter } = require('../middleware/rateLimiter');
const mcpService = require('../services/mcpService');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all MCP routes
router.use(authenticate);

// Get user's MCP servers
router.get('/', async (req, res) => {
  try {
    const userId = req.user.sub;
    const servers = await mcpService.getUserServers(userId);
    
    res.json({
      status: 'success',
      data: {
        servers,
        total: servers.length
      }
    });
  } catch (error) {
    logger.error('Error fetching MCP servers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch MCP servers'
    });
  }
});

// Get all servers (admin only)
router.get('/admin/all', 
  requirePermission('mcp:manage'),
  async (req, res) => {
    try {
      const servers = await mcpService.getAllServers();
      
      res.json({
        status: 'success',
        data: {
          servers,
          total: servers.length
        }
      });
    } catch (error) {
      logger.error('Error fetching all MCP servers:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch MCP servers'
      });
    }
  }
);

// Create new MCP server
router.post('/', 
  requirePermission('mcp:write'),
  securityLimiter(5, 300), // 5 servers per 5 minutes
  async (req, res) => {
    try {
      const userId = req.user.sub;
      const { name, description, command, args, env, enabled } = req.body;
      
      if (!name || !command) {
        return res.status(400).json({
          status: 'fail',
          message: 'Server name and command are required'
        });
      }
      
      const server = await mcpService.createServer(userId, {
        name,
        description,
        command,
        args,
        env,
        enabled
      });
      
      res.status(201).json({
        status: 'success',
        data: { server }
      });
    } catch (error) {
      logger.error('Error creating MCP server:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create MCP server'
      });
    }
  }
);

// Get specific server details
router.get('/:serverId', 
  requireResourceOwnership('mcpServer', 'serverId'),
  async (req, res) => {
    try {
      const { serverId } = req.params;
      const stats = await mcpService.getServerStats(serverId);
      
      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching MCP server stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch server details'
      });
    }
  }
);

// Update MCP server
router.put('/:serverId',
  requireResourceOwnership('mcpServer', 'serverId'),
  async (req, res) => {
    try {
      const { serverId } = req.params;
      const userId = req.user.sub;
      const updates = req.body;
      
      const server = await mcpService.updateServer(serverId, userId, updates);
      
      res.json({
        status: 'success',
        data: { server }
      });
    } catch (error) {
      logger.error('Error updating MCP server:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update MCP server'
      });
    }
  }
);

// Delete MCP server
router.delete('/:serverId',
  requireResourceOwnership('mcpServer', 'serverId'),
  async (req, res) => {
    try {
      const { serverId } = req.params;
      const userId = req.user.sub;
      
      await mcpService.removeServer(serverId, userId);
      
      res.json({
        status: 'success',
        message: 'Server removed successfully'
      });
    } catch (error) {
      logger.error('Error removing MCP server:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to remove MCP server'
      });
    }
  }
);

// Start MCP server
router.post('/:serverId/start',
  requireResourceOwnership('mcpServer', 'serverId'),
  requirePermission('mcp:execute'),
  async (req, res) => {
    try {
      const { serverId } = req.params;
      
      await mcpService.startServer(serverId);
      
      res.json({
        status: 'success',
        message: 'Server started successfully'
      });
    } catch (error) {
      logger.error('Error starting MCP server:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to start MCP server'
      });
    }
  }
);

// Stop MCP server
router.post('/:serverId/stop',
  requireResourceOwnership('mcpServer', 'serverId'),
  requirePermission('mcp:execute'),
  async (req, res) => {
    try {
      const { serverId } = req.params;
      
      await mcpService.stopServer(serverId);
      
      res.json({
        status: 'success',
        message: 'Server stopped successfully'
      });
    } catch (error) {
      logger.error('Error stopping MCP server:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to stop MCP server'
      });
    }
  }
);

// Execute tool on MCP server
router.post('/:serverId/execute',
  requireResourceOwnership('mcpServer', 'serverId'),
  requirePermission('mcp:execute'),
  securityLimiter(20, 60), // 20 executions per minute
  async (req, res) => {
    try {
      const { serverId } = req.params;
      const { toolName, parameters = {} } = req.body;
      
      if (!toolName) {
        return res.status(400).json({
          status: 'fail',
          message: 'Tool name is required'
        });
      }
      
      const result = await mcpService.executeTool(serverId, toolName, parameters);
      
      res.json({
        status: 'success',
        data: { result }
      });
    } catch (error) {
      logger.error('Error executing MCP tool:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to execute tool'
      });
    }
  }
);

// Get server logs
router.get('/:serverId/logs',
  requireResourceOwnership('mcpServer', 'serverId'),
  requirePermission('mcp:read'),
  async (req, res) => {
    try {
      const { serverId } = req.params;
      const { limit = 100 } = req.query;
      
      // Get tool call logs from database
      const logs = await prisma.mcpToolCall.findMany({
        where: { serverId },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        select: {
          id: true,
          toolName: true,
          success: true,
          executionTime: true,
          errorMessage: true,
          createdAt: true
        }
      });
      
      res.json({
        status: 'success',
        data: { 
          logs,
          total: logs.length 
        }
      });
    } catch (error) {
      logger.error('Error fetching MCP server logs:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch server logs'
      });
    }
  }
);

// Health check for all user servers
router.get('/health/check', async (req, res) => {
  try {
    const userId = req.user.sub;
    const servers = await mcpService.getUserServers(userId);
    
    const healthStatus = await Promise.all(
      servers.map(async (server) => {
        const isHealthy = await mcpService.checkServerHealth(server.id);
        return {
          id: server.id,
          name: server.name,
          healthy: isHealthy,
          status: server.healthStatus,
          lastCheck: server.lastHealthCheck
        };
      })
    );
    
    res.json({
      status: 'success',
      data: {
        servers: healthStatus,
        summary: {
          total: healthStatus.length,
          healthy: healthStatus.filter(s => s.healthy).length,
          unhealthy: healthStatus.filter(s => !s.healthy).length
        }
      }
    });
  } catch (error) {
    logger.error('Error performing health check:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform health check'
    });
  }
});

// Get MCP statistics (admin only)
router.get('/admin/statistics',
  requirePermission('admin:analytics'),
  async (req, res) => {
    try {
      const stats = await prisma.mcpServer.groupBy({
        by: ['healthStatus'],
        _count: { id: true }
      });
      
      const totalCalls = await prisma.mcpToolCall.count();
      const recentCalls = await prisma.mcpToolCall.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });
      
      const avgExecutionTime = await prisma.mcpToolCall.aggregate({
        _avg: { executionTime: true }
      });
      
      res.json({
        status: 'success',
        data: {
          serversByStatus: stats.reduce((acc, stat) => {
            acc[stat.healthStatus] = stat._count.id;
            return acc;
          }, {}),
          totalServers: stats.reduce((sum, stat) => sum + stat._count.id, 0),
          totalToolCalls: totalCalls,
          recentToolCalls: recentCalls,
          averageExecutionTime: avgExecutionTime._avg.executionTime || 0
        }
      });
    } catch (error) {
      logger.error('Error fetching MCP statistics:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch statistics'
      });
    }
  }
);

module.exports = router;
