const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const apiGatewayService = require('../services/apiGatewayService');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all gateway management routes
router.use(authenticate);

// Get gateway statistics (admin only)
router.get('/stats',
  requirePermission('admin:system'),
  async (req, res) => {
    try {
      const stats = apiGatewayService.getGatewayStats();
      
      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching gateway stats:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch gateway statistics'
      });
    }
  }
);

// Get all services health
router.get('/health',
  requirePermission('admin:system'),
  async (req, res) => {
    try {
      const health = apiGatewayService.getAllServicesHealth();
      
      res.json({
        status: 'success',
        data: health
      });
    } catch (error) {
      logger.error('Error fetching services health:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch services health'
      });
    }
  }
);

// Get specific service health
router.get('/health/:serviceName',
  requirePermission('admin:system'),
  async (req, res) => {
    try {
      const { serviceName } = req.params;
      const health = apiGatewayService.getServiceHealth(serviceName);
      
      res.json({
        status: 'success',
        data: health
      });
    } catch (error) {
      logger.error(`Error fetching health for service ${req.params.serviceName}:`, error);
      res.status(404).json({
        status: 'error',
        message: error.message || 'Service not found'
      });
    }
  }
);

// Register new service (admin only)
router.post('/services',
  requirePermission('admin:system'),
  async (req, res) => {
    try {
      const serviceConfig = req.body;
      
      if (!serviceConfig.name || !serviceConfig.instances) {
        return res.status(400).json({
          status: 'fail',
          message: 'Service name and instances are required'
        });
      }
      
      const service = apiGatewayService.registerService(serviceConfig);
      
      res.status(201).json({
        status: 'success',
        data: { service }
      });
    } catch (error) {
      logger.error('Error registering service:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to register service'
      });
    }
  }
);

// Unregister service (admin only)
router.delete('/services/:serviceName',
  requirePermission('admin:system'),
  async (req, res) => {
    try {
      const { serviceName } = req.params;
      
      apiGatewayService.unregisterService(serviceName);
      
      res.json({
        status: 'success',
        message: 'Service unregistered successfully'
      });
    } catch (error) {
      logger.error('Error unregistering service:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to unregister service'
      });
    }
  }
);

// Trigger health check for specific service
router.post('/health/:serviceName/check',
  requirePermission('admin:system'),
  async (req, res) => {
    try {
      const { serviceName } = req.params;
      
      await apiGatewayService.checkServiceHealth(serviceName);
      const health = apiGatewayService.getServiceHealth(serviceName);
      
      res.json({
        status: 'success',
        data: health
      });
    } catch (error) {
      logger.error(`Error checking health for service ${req.params.serviceName}:`, error);
      res.status(404).json({
        status: 'error',
        message: error.message || 'Service not found'
      });
    }
  }
);

// Get gateway configuration
router.get('/config',
  requirePermission('admin:system'),
  async (req, res) => {
    try {
      const config = {
        services: Array.from(apiGatewayService.services.entries()).map(([name, service]) => ({
          name,
          instances: service.instances.length,
          basePath: service.basePath,
          authentication: service.authentication,
          rateLimit: service.rateLimit,
          timeout: service.timeout
        })),
        healthCheckInterval: apiGatewayService.config.healthCheckInterval,
        loadBalancing: apiGatewayService.config.loadBalancing,
        timeout: apiGatewayService.config.timeoutMs
      };
      
      res.json({
        status: 'success',
        data: config
      });
    } catch (error) {
      logger.error('Error fetching gateway config:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fetch gateway configuration'
      });
    }
  }
);

module.exports = router;