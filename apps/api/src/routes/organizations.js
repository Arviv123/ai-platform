const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const { securityLimiter } = require('../middleware/rateLimiter');
const organizationService = require('../services/organizationService');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all organization routes
router.use(authenticate);

// Create new organization
router.post('/',
  requirePermission('orgs:write'),
  securityLimiter(2, 300), // 2 organizations per 5 minutes
  async (req, res) => {
    try {
      const userId = req.user.sub;
      const organizationData = req.body;

      if (!organizationData.name) {
        return res.status(400).json({
          status: 'fail',
          message: 'Organization name is required'
        });
      }

      const organization = await organizationService.createOrganization(userId, organizationData);

      res.status(201).json({
        status: 'success',
        data: { organization }
      });
    } catch (error) {
      logger.error('Error creating organization:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to create organization'
      });
    }
  }
);

// Get user's organizations
router.get('/', async (req, res) => {
  try {
    const userId = req.user.sub;
    const organizations = await organizationService.getUserOrganizations(userId);

    res.json({
      status: 'success',
      data: {
        organizations,
        total: organizations.length
      }
    });
  } catch (error) {
    logger.error('Error fetching user organizations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch organizations'
    });
  }
});

// Get specific organization details
router.get('/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { includeMembers = false } = req.query;
    
    const organization = await organizationService.getOrganization(
      organizationId, 
      includeMembers === 'true'
    );

    res.json({
      status: 'success',
      data: { organization }
    });
  } catch (error) {
    logger.error('Error fetching organization:', error);
    res.status(404).json({
      status: 'error',
      message: error.message || 'Organization not found'
    });
  }
});

// Update organization
router.put('/:organizationId',
  requirePermission('orgs:write'),
  async (req, res) => {
    try {
      const { organizationId } = req.params;
      const userId = req.user.sub;
      const updates = req.body;

      const organization = await organizationService.updateOrganization(
        organizationId, 
        userId, 
        updates
      );

      res.json({
        status: 'success',
        data: { organization }
      });
    } catch (error) {
      logger.error('Error updating organization:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to update organization'
      });
    }
  }
);

// Invite user to organization
router.post('/:organizationId/invitations',
  requirePermission('orgs:write'),
  securityLimiter(10, 300), // 10 invitations per 5 minutes
  async (req, res) => {
    try {
      const { organizationId } = req.params;
      const userId = req.user.sub;
      const inviteData = req.body;

      if (!inviteData.email) {
        return res.status(400).json({
          status: 'fail',
          message: 'Email is required for invitation'
        });
      }

      const invitation = await organizationService.inviteUser(
        organizationId, 
        userId, 
        inviteData
      );

      res.status(201).json({
        status: 'success',
        data: { invitation }
      });
    } catch (error) {
      logger.error('Error inviting user:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to send invitation'
      });
    }
  }
);

// Accept organization invitation
router.post('/invitations/:token/accept', async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.sub;

    const result = await organizationService.acceptInvitation(token, userId);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error accepting invitation:', error);
    res.status(400).json({
      status: 'error',
      message: error.message || 'Failed to accept invitation'
    });
  }
});

// Remove user from organization
router.delete('/:organizationId/members/:userId',
  requirePermission('orgs:manage'),
  async (req, res) => {
    try {
      const { organizationId, userId: targetUserId } = req.params;
      const adminUserId = req.user.sub;

      await organizationService.removeUser(organizationId, adminUserId, targetUserId);

      res.json({
        status: 'success',
        message: 'User removed from organization'
      });
    } catch (error) {
      logger.error('Error removing user from organization:', error);
      res.status(400).json({
        status: 'error',
        message: error.message || 'Failed to remove user'
      });
    }
  }
);

// Switch active organization
router.post('/:organizationId/switch', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user.sub;

    const organization = await organizationService.switchOrganization(userId, organizationId);

    res.json({
      status: 'success',
      data: { organization },
      message: 'Organization switched successfully'
    });
  } catch (error) {
    logger.error('Error switching organization:', error);
    res.status(400).json({
      status: 'error',
      message: error.message || 'Failed to switch organization'
    });
  }
});

// Get organization statistics (admin only)
router.get('/:organizationId/statistics',
  requirePermission('orgs:read'),
  async (req, res) => {
    try {
      const { organizationId } = req.params;
      const userId = req.user.sub;

      const stats = await organizationService.getOrganizationStats(organizationId, userId);

      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching organization statistics:', error);
      res.status(403).json({
        status: 'error',
        message: error.message || 'Failed to fetch statistics'
      });
    }
  }
);

// Get organization members (admin only)
router.get('/:organizationId/members',
  requirePermission('orgs:read'),
  async (req, res) => {
    try {
      const { organizationId } = req.params;
      
      const organization = await organizationService.getOrganization(organizationId, true);
      
      res.json({
        status: 'success',
        data: {
          members: organization.memberships,
          total: organization.memberships.length
        }
      });
    } catch (error) {
      logger.error('Error fetching organization members:', error);
      res.status(403).json({
        status: 'error',
        message: error.message || 'Failed to fetch members'
      });
    }
  }
);

module.exports = router;