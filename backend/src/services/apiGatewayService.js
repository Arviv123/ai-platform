const { EventEmitter } = require('events');
const httpProxy = require('http-proxy-middleware');
const logger = require('../utils/logger');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class APIGatewayService extends EventEmitter {
  constructor() {
    super();
    this.services = new Map(); // serviceName -> serviceConfig
    this.loadBalancers = new Map(); // serviceName -> loadBalancer
    this.healthChecks = new Map(); // serviceName -> healthStatus
    this.rateLimiters = new Map(); // serviceName -> rateLimiter
    
    // Default configuration
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      timeoutMs: 30000, // 30 seconds
      retryAttempts: 3,
      loadBalancing: 'round-robin' // round-robin, least-connections, weighted
    };
    
    this.init();
  }

  async init() {
    try {
      // Load service configurations
      await this.loadServices();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      logger.info('API Gateway initialized');
    } catch (error) {
      logger.error('Failed to initialize API Gateway:', error);
    }
  }

  // Register a microservice
  registerService(serviceConfig) {
    const {
      name,
      instances = [],
      basePath,
      healthEndpoint = '/health',
      authentication = true,
      rateLimit = null,
      timeout = this.config.timeoutMs
    } = serviceConfig;

    if (!name || !instances.length) {
      throw new Error('Service name and instances are required');
    }

    const service = {
      name,
      instances: instances.map(instance => ({
        ...instance,
        status: 'unknown',
        lastCheck: null,
        responseTime: 0,
        connections: 0
      })),
      basePath,
      healthEndpoint,
      authentication,
      rateLimit,
      timeout,
      registeredAt: new Date()
    };

    this.services.set(name, service);
    
    // Initialize load balancer
    this.loadBalancers.set(name, {
      currentIndex: 0,
      strategy: this.config.loadBalancing
    });

    logger.info(`Service registered: ${name} with ${instances.length} instances`);
    
    // Perform initial health check
    this.checkServiceHealth(name);
    
    return service;
  }

  // Unregister a microservice
  unregisterService(serviceName) {
    if (!this.services.has(serviceName)) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    this.services.delete(serviceName);
    this.loadBalancers.delete(serviceName);
    this.healthChecks.delete(serviceName);
    this.rateLimiters.delete(serviceName);

    logger.info(`Service unregistered: ${serviceName}`);
  }

  // Get service instance using load balancing
  getServiceInstance(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    const healthyInstances = service.instances.filter(
      instance => instance.status === 'healthy'
    );

    if (healthyInstances.length === 0) {
      throw new Error(`No healthy instances available for service: ${serviceName}`);
    }

    const loadBalancer = this.loadBalancers.get(serviceName);
    let selectedInstance;

    switch (loadBalancer.strategy) {
      case 'round-robin':
        selectedInstance = this.roundRobinSelection(healthyInstances, loadBalancer);
        break;
      case 'least-connections':
        selectedInstance = this.leastConnectionsSelection(healthyInstances);
        break;
      case 'weighted':
        selectedInstance = this.weightedSelection(healthyInstances);
        break;
      default:
        selectedInstance = healthyInstances[0];
    }

    // Increment connection count
    selectedInstance.connections++;

    return selectedInstance;
  }

  // Round-robin load balancing
  roundRobinSelection(instances, loadBalancer) {
    const instance = instances[loadBalancer.currentIndex % instances.length];
    loadBalancer.currentIndex = (loadBalancer.currentIndex + 1) % instances.length;
    return instance;
  }

  // Least connections load balancing
  leastConnectionsSelection(instances) {
    return instances.reduce((min, instance) => 
      instance.connections < min.connections ? instance : min
    );
  }

  // Weighted load balancing
  weightedSelection(instances) {
    const totalWeight = instances.reduce((sum, instance) => 
      sum + (instance.weight || 1), 0
    );
    
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= (instance.weight || 1);
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0]; // Fallback
  }

  // Create proxy middleware for a service
  createProxy(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    return httpProxy({
      target: (req) => {
        try {
          const instance = this.getServiceInstance(serviceName);
          return `${instance.protocol || 'http'}://${instance.host}:${instance.port}`;
        } catch (error) {
          logger.error(`Proxy target error for ${serviceName}:`, error);
          throw error;
        }
      },
      changeOrigin: true,
      pathRewrite: service.basePath ? {
        [`^${service.basePath}`]: ''
      } : undefined,
      timeout: service.timeout,
      onProxyReq: (proxyReq, req, res) => {
        // Add headers for tracing
        proxyReq.setHeader('X-Gateway-Service', serviceName);
        proxyReq.setHeader('X-Request-Id', req.id || this.generateRequestId());
        
        // Log request
        logger.debug(`Proxying ${req.method} ${req.url} to ${serviceName}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        // Add response headers
        proxyRes.headers['X-Gateway-Service'] = serviceName;
        
        // Update instance metrics
        const instance = this.getServiceInstanceByRequest(serviceName, req);
        if (instance) {
          instance.connections = Math.max(0, instance.connections - 1);
          instance.responseTime = Date.now() - req.startTime;
        }
      },
      onError: (err, req, res) => {
        logger.error(`Proxy error for ${serviceName}:`, err);
        
        // Update instance metrics
        const instance = this.getServiceInstanceByRequest(serviceName, req);
        if (instance) {
          instance.connections = Math.max(0, instance.connections - 1);
          instance.status = 'unhealthy';
        }
        
        res.status(503).json({
          status: 'error',
          message: 'Service temporarily unavailable',
          service: serviceName
        });
      }
    });
  }

  // Route request to appropriate service
  async routeRequest(req, res, next) {
    try {
      const path = req.path;
      req.startTime = Date.now();
      
      // Find matching service based on path
      let matchedService = null;
      let basePath = '';
      
      for (const [serviceName, service] of this.services) {
        if (service.basePath && path.startsWith(service.basePath)) {
          if (service.basePath.length > basePath.length) {
            matchedService = serviceName;
            basePath = service.basePath;
          }
        }
      }
      
      if (!matchedService) {
        return res.status(404).json({
          status: 'error',
          message: 'Service not found for this path'
        });
      }
      
      // Apply service-specific middleware
      const service = this.services.get(matchedService);
      
      // Rate limiting
      if (service.rateLimit) {
        const rateLimited = await this.checkRateLimit(matchedService, req);
        if (rateLimited) {
          return res.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded'
          });
        }
      }
      
      // Create and apply proxy
      const proxy = this.createProxy(matchedService);
      proxy(req, res, next);
      
    } catch (error) {
      logger.error('Request routing error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal gateway error'
      });
    }
  }

  // Check service health
  async checkServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) return;

    const healthPromises = service.instances.map(async (instance) => {
      try {
        const startTime = Date.now();
        const healthUrl = `${instance.protocol || 'http'}://${instance.host}:${instance.port}${service.healthEndpoint}`;
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          timeout: 5000,
          headers: {
            'User-Agent': 'AI-Platform-Gateway/1.0'
          }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          instance.status = 'healthy';
          instance.responseTime = responseTime;
          instance.lastCheck = new Date();
        } else {
          instance.status = 'unhealthy';
        }
        
      } catch (error) {
        logger.warn(`Health check failed for ${serviceName} instance ${instance.host}:${instance.port}:`, error.message);
        instance.status = 'unhealthy';
        instance.lastCheck = new Date();
      }
    });

    await Promise.allSettled(healthPromises);
    
    const healthyCount = service.instances.filter(i => i.status === 'healthy').length;
    this.healthChecks.set(serviceName, {
      total: service.instances.length,
      healthy: healthyCount,
      lastCheck: new Date()
    });

    // Emit health status change event
    this.emit('healthChange', {
      serviceName,
      healthy: healthyCount,
      total: service.instances.length
    });
  }

  // Start health monitoring
  startHealthMonitoring() {
    setInterval(() => {
      for (const serviceName of this.services.keys()) {
        this.checkServiceHealth(serviceName);
      }
    }, this.config.healthCheckInterval);
  }

  // Get service health status
  getServiceHealth(serviceName) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }

    return {
      name: serviceName,
      instances: service.instances.map(instance => ({
        host: instance.host,
        port: instance.port,
        status: instance.status,
        responseTime: instance.responseTime,
        lastCheck: instance.lastCheck,
        connections: instance.connections
      })),
      health: this.healthChecks.get(serviceName) || { total: 0, healthy: 0 }
    };
  }

  // Get all services health
  getAllServicesHealth() {
    const health = {};
    for (const serviceName of this.services.keys()) {
      health[serviceName] = this.getServiceHealth(serviceName);
    }
    return health;
  }

  // Load services from configuration
  async loadServices() {
    // Default microservices configuration
    const defaultServices = [
      {
        name: 'auth-service',
        instances: [
          { host: 'localhost', port: 3006 }
        ],
        basePath: '/api/auth',
        healthEndpoint: '/health'
      },
      {
        name: 'chat-service',
        instances: [
          { host: 'localhost', port: 3007 }
        ],
        basePath: '/api/chat',
        healthEndpoint: '/health'
      },
      {
        name: 'mcp-service',
        instances: [
          { host: 'localhost', port: 3008 }
        ],
        basePath: '/api/mcp',
        healthEndpoint: '/health'
      }
    ];

    // Register default services (for future microservices architecture)
    for (const serviceConfig of defaultServices) {
      try {
        // Only register if not already registered
        if (!this.services.has(serviceConfig.name)) {
          // this.registerService(serviceConfig);
          logger.info(`Service configuration loaded: ${serviceConfig.name}`);
        }
      } catch (error) {
        logger.warn(`Failed to register service ${serviceConfig.name}:`, error.message);
      }
    }
  }

  // Rate limiting check
  async checkRateLimit(serviceName, req) {
    // Implement rate limiting logic here
    // For now, return false (no rate limiting)
    return false;
  }

  // Get service instance by request (for metrics)
  getServiceInstanceByRequest(serviceName, req) {
    const service = this.services.get(serviceName);
    if (!service) return null;
    
    // Simple implementation - return first healthy instance
    return service.instances.find(instance => instance.status === 'healthy');
  }

  // Generate request ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get gateway statistics
  getGatewayStats() {
    const stats = {
      services: this.services.size,
      totalInstances: 0,
      healthyInstances: 0,
      uptime: process.uptime(),
      requestCount: 0, // TODO: Implement request counting
      errorCount: 0,   // TODO: Implement error counting
      serviceStats: {}
    };

    for (const [serviceName, service] of this.services) {
      const health = this.healthChecks.get(serviceName) || { total: 0, healthy: 0 };
      
      stats.totalInstances += health.total;
      stats.healthyInstances += health.healthy;
      
      stats.serviceStats[serviceName] = {
        instances: health.total,
        healthy: health.healthy,
        responseTime: service.instances.reduce((avg, instance) => 
          avg + instance.responseTime, 0) / service.instances.length || 0
      };
    }

    return stats;
  }

  // Shutdown gateway
  async shutdown() {
    logger.info('Shutting down API Gateway...');
    // Clear all timers and cleanup
    this.removeAllListeners();
    logger.info('API Gateway shutdown complete');
  }
}

// Create singleton instance
const apiGatewayService = new APIGatewayService();

// Graceful shutdown
process.on('SIGTERM', () => apiGatewayService.shutdown());
process.on('SIGINT', () => apiGatewayService.shutdown());

module.exports = apiGatewayService;