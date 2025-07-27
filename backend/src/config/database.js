const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

// Initialize Prisma Client with configuration
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
  errorFormat: 'pretty',
});

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug('Database Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    });
  });
}

// Log database errors
prisma.$on('error', (e) => {
  logger.error('Database Error:', e);
});

// Log database info
prisma.$on('info', (e) => {
  logger.info('Database Info:', e.message);
});

// Log database warnings
prisma.$on('warn', (e) => {
  logger.warn('Database Warning:', e.message);
});

// Database connection function
const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    
    // Test the connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection test passed');
    
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Database disconnection function
const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
};

// Health check function
const checkDBHealth = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString() 
    };
  }
};

// Transaction wrapper with retry logic
const withTransaction = async (callback, maxRetries = 3) => {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(callback);
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        logger.error(`Transaction failed after ${maxRetries} attempts:`, error);
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn(`Transaction attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Database utilities
const dbUtils = {
  // Pagination helper
  paginate: (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    return { skip, take: limit };
  },

  // Search helper
  search: (searchTerm, fields) => {
    if (!searchTerm) return {};
    
    return {
      OR: fields.map(field => ({
        [field]: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      }))
    };
  },

  // Date range helper
  dateRange: (startDate, endDate, field = 'createdAt') => {
    const where = {};
    
    if (startDate || endDate) {
      where[field] = {};
      if (startDate) where[field].gte = new Date(startDate);
      if (endDate) where[field].lte = new Date(endDate);
    }
    
    return where;
  },

  // Soft delete helper
  softDelete: async (model, id) => {
    return await prisma[model].update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  },

  // Restore soft deleted record
  restore: async (model, id) => {
    return await prisma[model].update({
      where: { id },
      data: { deletedAt: null }
    });
  }
};

module.exports = {
  prisma,
  connectDB,
  disconnectDB,
  checkDBHealth,
  withTransaction,
  dbUtils
};