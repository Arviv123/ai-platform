const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Permission definitions
const PERMISSIONS = {
  // User permissions
  'users:read': 'View users',
  'users:write': 'Create and edit users',
  'users:delete': 'Delete users',
  'users:manage': 'Full user management',

  // Organization permissions
  'orgs:read': 'View organization details',
  'orgs:write': 'Edit organization settings',
  'orgs:manage': 'Full organization management',
  'orgs:billing': 'Manage organization billing',

  // AI Chat permissions
  'chat:basic': 'Basic chat functionality',
  'chat:advanced': 'Advanced AI models',
  'chat:unlimited': 'Unlimited usage',

  // MCP permissions
  'mcp:read': 'View MCP servers',
  'mcp:write': 'Create and edit MCP servers',
  'mcp:execute': 'Execute MCP tools',
  'mcp:manage': 'Full MCP management',

  // Admin permissions
  'admin:system': 'System administration',
  'admin:billing': 'Billing administration',
  'admin:analytics': 'Analytics and reporting',
  'admin:security': 'Security management',

  // API permissions
  'api:read': 'Read API access',
  'api:write': 'Write API access',
  'api:admin': 'Admin API access'
};

// Role definitions with permissions
const ROLES = {
  'SUPER_ADMIN': {
    name: 'Super Administrator',
    description: 'Full system access',
    permissions: Object.keys(PERMISSIONS)
  },
  'ADMIN': {
    name: 'Administrator',
    description: 'Organization administrator',
    permissions: [
      'users:read', 'users:write', 'users:delete',
      'orgs:read', 'orgs:write', 'orgs:billing',
      'chat:unlimited', 'mcp:manage',
      'admin:billing', 'admin:analytics',
      'api:read', 'api:write'
    ]
  },
  'MANAGER': {
    name: 'Manager',
    description: 'Team manager',
    permissions: [
      'users:read', 'users:write',
      'orgs:read',
      'chat:advanced', 'mcp:read', 'mcp:write',
      'api:read'
    ]
  },
  'USER': {
    name: 'User',
    description: 'Standard user',
    permissions: [
      'chat:basic', 'mcp:read', 'mcp:execute'
    ]
  },
  'VIEWER': {
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      'chat:basic', 'mcp:read'
    ]
  }
};

// Get user permissions
exports.getUserPermissions = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Collect permissions from all roles
    const permissions = new Set();
    
    // Add permissions from primary role
    const primaryRole = ROLES[user.role];
    if (primaryRole) {
      primaryRole.permissions.forEach(permission => {
        permissions.add(permission);
      });
    }

    // Add permissions from assigned roles
    user.roleAssignments.forEach(assignment => {
      assignment.role.permissions.forEach(permission => {
        permissions.add(permission.name);
      });
    });

    return Array.from(permissions);

  } catch (error) {
    logger.error('Error getting user permissions:', error);
    throw error;
  }
};

// Check if user has permission
exports.hasPermission = async (userId, permission) => {
  try {
    const userPermissions = await exports.getUserPermissions(userId);
    return userPermissions.includes(permission);
  } catch (error) {
    logger.error('Error checking permission:', error);
    return false;
  }
};

// RBAC middleware factory
exports.requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      
      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required'
        });
      }

      const hasAccess = await exports.hasPermission(userId, permission);
      
      if (!hasAccess) {
        // Log unauthorized access attempt
        logger.warn(`Unauthorized access attempt: User ${userId} tried to access ${permission}`);
        
        return res.status(403).json({
          status: 'fail',
          message: 'Insufficient permissions',
          required: permission
        });
      }

      // Add user permissions to request for further use
      req.userPermissions = await exports.getUserPermissions(userId);
      next();

    } catch (error) {
      logger.error('RBAC middleware error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Permission check failed'
      });
    }
  };
};

// Multiple permissions check (user needs ALL permissions)
exports.requireAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      
      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required'
        });
      }

      const userPermissions = await exports.getUserPermissions(userId);
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          status: 'fail',
          message: 'Insufficient permissions',
          required: permissions
        });
      }

      req.userPermissions = userPermissions;
      next();

    } catch (error) {
      logger.error('RBAC multiple permissions error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Permission check failed'
      });
    }
  };
};

// Any permission check (user needs AT LEAST ONE permission)
exports.requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      
      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required'
        });
      }

      const userPermissions = await exports.getUserPermissions(userId);
      const hasAnyPermission = permissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasAnyPermission) {
        return res.status(403).json({
          status: 'fail',
          message: 'Insufficient permissions',
          required: `One of: ${permissions.join(', ')}`
        });
      }

      req.userPermissions = userPermissions;
      next();

    } catch (error) {
      logger.error('RBAC any permission error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Permission check failed'
      });
    }
  };
};

// Organization-based access control
exports.requireOrganizationAccess = (action = 'read') => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      const organizationId = req.params.organizationId || req.body.organizationId;

      if (!userId) {
        return res.status(401).json({
          status: 'fail',
          message: 'Authentication required'
        });
      }

      if (!organizationId) {
        return res.status(400).json({
          status: 'fail',
          message: 'Organization ID required'
        });
      }

      // Check if user belongs to the organization
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: true,
          organizationMemberships: {
            where: { organizationId },
            include: { role: true }
          }
        }
      });

      if (!user) {
        return res.status(404).json({
          status: 'fail',
          message: 'User not found'
        });
      }

      // Check direct organization membership
      if (user.organizationId === organizationId) {
        req.organizationRole = user.role;
        return next();
      }

      // Check organization memberships
      const membership = user.organizationMemberships.find(
        m => m.organizationId === organizationId
      );

      if (!membership) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied: Not a member of this organization'
        });
      }

      // Check action permissions based on role
      const rolePermissions = {
        'read': ['USER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
        'write': ['MANAGER', 'ADMIN', 'SUPER_ADMIN'],
        'admin': ['ADMIN', 'SUPER_ADMIN']
      };

      const allowedRoles = rolePermissions[action] || rolePermissions['read'];
      
      if (!allowedRoles.includes(membership.role.name)) {
        return res.status(403).json({
          status: 'fail',
          message: `Access denied: Insufficient role for ${action} access`
        });
      }

      req.organizationRole = membership.role.name;
      req.organizationMembership = membership;
      next();

    } catch (error) {
      logger.error('Organization access control error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Access control check failed'
      });
    }
  };
};

// Resource ownership check
exports.requireResourceOwnership = (resourceType, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.sub;
      const resourceId = req.params[resourceIdParam];

      if (!userId || !resourceId) {
        return res.status(400).json({
          status: 'fail',
          message: 'User ID and resource ID required'
        });
      }

      // Define resource ownership queries
      const ownershipQueries = {
        'chatSession': () => prisma.chatSession.findUnique({
          where: { id: resourceId },
          select: { userId: true }
        }),
        'mcpServer': () => prisma.mcpServer.findUnique({
          where: { id: resourceId, deletedAt: null },
          select: { userId: true }
        }),
        'promptTemplate': () => prisma.promptTemplate.findUnique({
          where: { id: resourceId },
          select: { userId: true }
        })
      };

      const query = ownershipQueries[resourceType];
      if (!query) {
        return res.status(400).json({
          status: 'fail',
          message: 'Unknown resource type'
        });
      }

      const resource = await query();
      
      if (!resource) {
        return res.status(404).json({
          status: 'fail',
          message: 'Resource not found'
        });
      }

      if (resource.userId !== userId) {
        // Check if user has admin permissions as fallback
        const hasAdminAccess = await exports.hasPermission(userId, 'admin:system');
        
        if (!hasAdminAccess) {
          return res.status(403).json({
            status: 'fail',
            message: 'Access denied: You do not own this resource'
          });
        }
      }

      next();

    } catch (error) {
      logger.error('Resource ownership check error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Ownership check failed'
      });
    }
  };
};

// Export role and permission definitions
exports.ROLES = ROLES;
exports.PERMISSIONS = PERMISSIONS;