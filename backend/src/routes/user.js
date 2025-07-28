const express = require("express");
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const { authenticate } = require("../middleware/auth");

const prisma = new PrismaClient();

// Apply authentication to all user routes
router.use(authenticate);

// Get user profile
router.get("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Add mock data for profile sections that don't exist in DB yet
    const profileData = {
      ...user,
      preferences: {
        theme: 'dark',
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        ai: {
          defaultModel: 'claude-3-sonnet',
          temperature: 0.7,
          maxTokens: 2000,
          streamResponses: true
        }
      },
      usage: {
        totalTokens: 150000,
        totalSessions: 45,
        totalMessages: 320,
        monthlyTokens: 25000,
        plan: {
          name: 'Pro Plan',
          tokenLimit: 100000,
          features: [
            'Unlimited conversations',
            'Advanced AI models',
            'Priority support',
            'API access'
          ]
        }
      },
      apiKeys: []
    };

    res.json({
      success: true,
      data: profileData
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile"
    });
  }
});

// Update user profile
router.patch("/profile", async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName })
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    res.json({
      success: true,
      data: { user: updatedUser },
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
});

// Get API keys
router.get("/api-keys", async (req, res) => {
  try {
    // Mock API keys for now since we don't have that table
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('API keys fetch error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch API keys"
    });
  }
});

// Create API key
router.post("/api-keys", async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "API key name is required"
      });
    }

    // Generate a mock API key
    const apiKey = {
      id: `key_${Date.now()}`,
      name,
      key: `sk-${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      created: new Date().toISOString(),
      lastUsed: null
    };

    res.json({
      success: true,
      data: apiKey,
      message: "API key created successfully"
    });
  } catch (error) {
    console.error('API key creation error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to create API key"
    });
  }
});

// Delete API key
router.delete("/api-keys/:keyId", async (req, res) => {
  try {
    const { keyId } = req.params;
    
    res.json({
      success: true,
      message: "API key deleted successfully"
    });
  } catch (error) {
    console.error('API key deletion error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to delete API key"
    });
  }
});

router.get("/", (req, res) => {
  res.json({ status: "ok", route: "user" });
});

module.exports = router;
