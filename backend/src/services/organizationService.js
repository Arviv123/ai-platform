const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { generateSecureToken } = require('../utils/encryption');

const prisma = new PrismaClient();

class OrganizationService {
  constructor() {
    this.invitationExpiry = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  // Create new organization
  async createOrganization(userId, organizationData) {
    try {
      const {
        name,
        description,
        domain,
        subscriptionTier = 'free',
        maxUsers = 10,
        maxStorage = 1000,
        billingEmail
      } = organizationData;

      // Check if domain is already taken
      if (domain) {
        const existingOrg = await prisma.organization.findUnique({
          where: { domain }
        });
        
        if (existingOrg) {
          throw new Error('Domain already registered to another organization');
        }
      }

      // Generate unique slug
      const baseSlug = name.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      let slug = baseSlug;
      let counter = 1;
      
      while (await prisma.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create organization
      const organization = await prisma.organization.create({
        data: {
          name,
          slug,
          description,
          domain,
          subscriptionTier,
          maxUsers,
          maxStorage,
          billingEmail: billingEmail || null,
          settings: JSON.stringify({
            allowInvitations: true,
            requireDomainVerification: false,
            defaultRole: 'USER',
            features: {
              mcp: subscriptionTier !== 'free',
              analytics: subscriptionTier === 'enterprise',
              customRoles: subscriptionTier === 'enterprise'
            }
          })
        }
      });

      // Create admin role for organization
      const adminRole = await prisma.role.create({
        data: {
          organizationId: organization.id,
          name: 'ADMIN',
          description: 'Organization Administrator',
          isSystemRole: false
        }
      });

      // Add creator as organization admin
      await prisma.organizationMembership.create({
        data: {
          userId,
          organizationId: organization.id,
          roleId: adminRole.id,
          status: 'active',
          joinedAt: new Date()
        }
      });

      // Update user's organization
      await prisma.user.update({
        where: { id: userId },
        data: { organizationId: organization.id }
      });

      logger.info(`Organization created: ${organization.name} (${organization.id}) by user ${userId}`);

      return {
        ...organization,
        settings: JSON.parse(organization.settings || '{}')
      };
    } catch (error) {
      logger.error('Error creating organization:', error);
      throw error;
    }
  }

  // Get organization details
  async getOrganization(organizationId, includeMembers = false) {
    try {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          memberships: includeMembers ? {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  lastLogin: true
                }
              },
              role: true
            }
          } : false,
          roles: true
        }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      return {
        ...organization,
        settings: JSON.parse(organization.settings || '{}'),
        memberCount: includeMembers ? organization.memberships.length : undefined
      };
    } catch (error) {
      logger.error('Error fetching organization:', error);
      throw error;
    }
  }

  // Update organization
  async updateOrganization(organizationId, userId, updates) {
    try {
      // Verify admin access
      await this.verifyOrganizationAdmin(organizationId, userId);

      const { settings, ...otherUpdates } = updates;

      const updateData = {
        ...otherUpdates,
        updatedAt: new Date()
      };

      if (settings) {
        const currentOrg = await prisma.organization.findUnique({
          where: { id: organizationId }
        });
        
        const currentSettings = JSON.parse(currentOrg.settings || '{}');
        const mergedSettings = { ...currentSettings, ...settings };
        updateData.settings = JSON.stringify(mergedSettings);
      }

      const organization = await prisma.organization.update({
        where: { id: organizationId },
        data: updateData
      });

      return {
        ...organization,
        settings: JSON.parse(organization.settings || '{}')
      };
    } catch (error) {
      logger.error('Error updating organization:', error);
      throw error;
    }
  }

  // Invite user to organization
  async inviteUser(organizationId, inviterUserId, inviteData) {
    try {
      const { email, roleId, message } = inviteData;

      // Verify admin access
      await this.verifyOrganizationAdmin(organizationId, inviterUserId);

      // Check organization settings
      const organization = await this.getOrganization(organizationId);
      const settings = organization.settings;

      if (!settings.allowInvitations) {
        throw new Error('Organization does not allow invitations');
      }

      // Check if user already exists in organization
      const existingMembership = await prisma.organizationMembership.findFirst({
        where: {
          organizationId,
          user: { email }
        }
      });

      if (existingMembership) {
        throw new Error('User is already a member of this organization');
      }

      // Check member limit
      const currentMemberCount = await prisma.organizationMembership.count({
        where: { organizationId }
      });

      if (currentMemberCount >= organization.maxUsers) {
        throw new Error('Organization has reached its member limit');
      }

      // Generate invitation token
      const invitationToken = generateSecureToken(32);
      const expiresAt = new Date(Date.now() + this.invitationExpiry);

      // Create invitation record (simplified - in real app would be separate table)
      const invitation = {
        token: invitationToken,
        email,
        organizationId,
        roleId,
        invitedBy: inviterUserId,
        message,
        expiresAt: expiresAt.toISOString(),
        status: 'pending'
      };

      // Store invitation in organization settings (simplified approach)
      const currentSettings = organization.settings;
      if (!currentSettings.pendingInvitations) {
        currentSettings.pendingInvitations = [];
      }
      
      currentSettings.pendingInvitations.push(invitation);

      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          settings: JSON.stringify(currentSettings)
        }
      });

      logger.info(`User invited to organization: ${email} -> ${organization.name}`);

      // In real implementation, send email here
      // await emailService.sendInvitation(email, invitation);

      return {
        invitationToken,
        email,
        organizationName: organization.name,
        expiresAt
      };
    } catch (error) {
      logger.error('Error inviting user:', error);
      throw error;
    }
  }

  // Accept organization invitation
  async acceptInvitation(invitationToken, userId) {
    try {
      // Find organization with this invitation
      const organizations = await prisma.organization.findMany();
      
      let invitation = null;
      let organization = null;

      for (const org of organizations) {
        const settings = JSON.parse(org.settings || '{}');
        if (settings.pendingInvitations) {
          const foundInvitation = settings.pendingInvitations.find(
            inv => inv.token === invitationToken && inv.status === 'pending'
          );
          
          if (foundInvitation) {
            invitation = foundInvitation;
            organization = org;
            break;
          }
        }
      }

      if (!invitation) {
        throw new Error('Invalid or expired invitation');
      }

      // Check expiration
      if (new Date(invitation.expiresAt) < new Date()) {
        throw new Error('Invitation has expired');
      }

      // Get user email to verify
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (user.email !== invitation.email) {
        throw new Error('Invitation email does not match user email');
      }

      // Create membership
      await prisma.organizationMembership.create({
        data: {
          userId,
          organizationId: organization.id,
          roleId: invitation.roleId,
          status: 'active',
          joinedAt: new Date()
        }
      });

      // Update user's primary organization if not set
      const currentUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!currentUser.organizationId) {
        await prisma.user.update({
          where: { id: userId },
          data: { organizationId: organization.id }
        });
      }

      // Remove invitation from pending list
      const settings = JSON.parse(organization.settings || '{}');
      settings.pendingInvitations = settings.pendingInvitations.filter(
        inv => inv.token !== invitationToken
      );
      invitation.status = 'accepted';

      if (!settings.acceptedInvitations) {
        settings.acceptedInvitations = [];
      }
      settings.acceptedInvitations.push({
        ...invitation,
        acceptedAt: new Date().toISOString(),
        acceptedBy: userId
      });

      await prisma.organization.update({
        where: { id: organization.id },
        data: {
          settings: JSON.stringify(settings)
        }
      });

      logger.info(`Invitation accepted: ${user.email} joined ${organization.name}`);

      return {
        organization: {
          ...organization,
          settings
        },
        message: 'Successfully joined organization'
      };
    } catch (error) {
      logger.error('Error accepting invitation:', error);
      throw error;
    }
  }

  // Remove user from organization
  async removeUser(organizationId, adminUserId, targetUserId) {
    try {
      // Verify admin access
      await this.verifyOrganizationAdmin(organizationId, adminUserId);

      // Can't remove yourself if you're the only admin
      const adminMemberships = await prisma.organizationMembership.findMany({
        where: {
          organizationId,
          role: { name: 'ADMIN' }
        }
      });

      if (adminMemberships.length === 1 && adminMemberships[0].userId === targetUserId) {
        throw new Error('Cannot remove the last admin from organization');
      }

      // Remove membership
      await prisma.organizationMembership.deleteMany({
        where: {
          organizationId,
          userId: targetUserId
        }
      });

      // If this was user's primary organization, clear it
      const user = await prisma.user.findUnique({
        where: { id: targetUserId }
      });

      if (user.organizationId === organizationId) {
        await prisma.user.update({
          where: { id: targetUserId },
          data: { organizationId: null }
        });
      }

      logger.info(`User removed from organization: ${targetUserId} from ${organizationId}`);
      
      return { success: true };
    } catch (error) {
      logger.error('Error removing user from organization:', error);
      throw error;
    }
  }

  // Switch user's active organization
  async switchOrganization(userId, organizationId) {
    try {
      // Verify user is member of organization
      const membership = await prisma.organizationMembership.findFirst({
        where: {
          userId,
          organizationId,
          status: 'active'
        }
      });

      if (!membership) {
        throw new Error('User is not a member of this organization');
      }

      // Update user's active organization
      await prisma.user.update({
        where: { id: userId },
        data: { organizationId }
      });

      const organization = await this.getOrganization(organizationId);

      return organization;
    } catch (error) {
      logger.error('Error switching organization:', error);
      throw error;
    }
  }

  // Get user's organizations
  async getUserOrganizations(userId) {
    try {
      const memberships = await prisma.organizationMembership.findMany({
        where: {
          userId,
          status: 'active'
        },
        include: {
          organization: true,
          role: true
        }
      });

      return memberships.map(membership => ({
        ...membership.organization,
        settings: JSON.parse(membership.organization.settings || '{}'),
        userRole: membership.role.name,
        joinedAt: membership.joinedAt
      }));
    } catch (error) {
      logger.error('Error fetching user organizations:', error);
      throw error;
    }
  }

  // Verify user is admin of organization
  async verifyOrganizationAdmin(organizationId, userId) {
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId,
        status: 'active'
      },
      include: { role: true }
    });

    if (!membership || membership.role.name !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    return membership;
  }

  // Get organization statistics
  async getOrganizationStats(organizationId, userId) {
    try {
      await this.verifyOrganizationAdmin(organizationId, userId);

      const [
        memberCount,
        mcpServerCount,
        totalApiCalls,
        recentActivity
      ] = await Promise.all([
        prisma.organizationMembership.count({
          where: { organizationId, status: 'active' }
        }),
        prisma.mcpServer.count({
          where: {
            user: {
              organizationMemberships: {
                some: { organizationId }
              }
            },
            deletedAt: null
          }
        }),
        prisma.mcpToolCall.count({
          where: {
            server: {
              user: {
                organizationMemberships: {
                  some: { organizationId }
                }
              }
            }
          }
        }),
        prisma.mcpToolCall.findMany({
          where: {
            server: {
              user: {
                organizationMemberships: {
                  some: { organizationId }
                }
              }
            },
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            server: {
              select: { name: true }
            }
          }
        })
      ]);

      return {
        memberCount,
        mcpServerCount,
        totalApiCalls,
        recentActivity: recentActivity.map(activity => ({
          id: activity.id,
          toolName: activity.toolName,
          serverName: activity.server.name,
          success: activity.success,
          executionTime: activity.executionTime,
          createdAt: activity.createdAt
        }))
      };
    } catch (error) {
      logger.error('Error fetching organization stats:', error);
      throw error;
    }
  }
}

// Create singleton instance
const organizationService = new OrganizationService();

module.exports = organizationService;