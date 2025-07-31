const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");

const prisma = new PrismaClient();

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production", { expiresIn: "7d" });

// Demo users for fallback mode
const demoUsers = {
  'admin@nedlan-ai.co.il': { 
    id: 'admin-1',
    firstName: 'מנהל', 
    lastName: 'נדל"ן AI', 
    role: 'ADMIN',
    password: 'Admin2024!'
  },
  'architect@nedlan-ai.co.il': { 
    id: 'user-1',
    firstName: 'אדריכל', 
    lastName: 'מקצועי', 
    role: 'USER',
    password: 'Architect2024!'
  },
  'planner@nedlan-ai.co.il': { 
    id: 'user-2',
    firstName: 'מתכנן', 
    lastName: 'עירוני', 
    role: 'USER',
    password: 'Planner2024!'
  },
  'contractor@nedlan-ai.co.il': { 
    id: 'user-3',
    firstName: 'קבלן', 
    lastName: 'בנייה', 
    role: 'USER',
    password: 'Builder2024!'
  },
  'investor@nedlan-ai.co.il': { 
    id: 'user-4',
    firstName: 'משקיע', 
    lastName: 'נדלן', 
    role: 'USER',
    password: 'Investor2024!'
  }
};

// User registration
exports.register = async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password,
      agreeTerms 
    } = req.body || {};

    console.log('📝 Registration attempt:', { email, firstName, lastName });

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        status: "fail", 
        message: "יש למלא את כל השדות הנדרשים" 
      });
    }

    if (!agreeTerms) {
      return res.status(400).json({ 
        status: "fail", 
        message: "יש להסכים לתנאי השימוש" 
      });
    }

    try {
      // Try database first
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ 
          status: "fail", 
          message: "המשתמש כבר קיים במערכת" 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user in database
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'USER'
        }
      });

      console.log('✅ User created in database:', email);

      const token = sign({ 
        id: user.id, 
        email: user.email, 
        role: user.role 
      });

      return res.status(201).json({
        status: "success",
        accessToken: token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          mfaEnabled: false
        }
      });

    } catch (dbError) {
      console.log('⚠️ Database error during registration, using fallback:', dbError.message);
      
      // Fallback mode - simulate registration
      const userId = 'user-' + Date.now();
      const token = sign({ 
        id: userId, 
        email: email, 
        role: 'USER' 
      });

      return res.status(201).json({
        status: "success",
        accessToken: token,
        user: {
          id: userId,
          email: email,
          firstName: firstName,
          lastName: lastName,
          role: 'USER',
          organizationId: null,
          mfaEnabled: false
        }
      });
    }

  } catch (error) {
    logger.error("Registration error:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "שגיאה פנימית בשרת" 
    });
  }
};

// User login
exports.login = async (req, res) => {
  console.log('🚀 Login endpoint hit!');
  try {
    const { email, password } = req.body || {};
    
    console.log('🔐 Login attempt:', { email, hasPassword: !!password });
    console.log('📥 Full request body:', req.body);
    
    if (!email || !password) {
      return res.status(400).json({ 
        status: "fail", 
        message: "יש להזין דוא״ל וסיסמה" 
      });
    }
    
    try {
      console.log('🔍 Attempting database query...');
      // Try database first
      const user = await prisma.user.findUnique({
        where: { email }
      });
      
      if (user) {
        console.log('✅ User found in database:', user.id);
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
          return res.status(401).json({ 
            status: "fail", 
            message: "דוא״ל או סיסמה שגויים" 
          });
        }
        
        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() }
        });
        
        const token = sign({ 
          id: user.id, 
          email: user.email, 
          role: user.role 
        });
        
        return res.status(200).json({
          status: "success",
          accessToken: token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            organizationId: user.organizationId,
            mfaEnabled: user.mfaEnabled || false
          }
        });
      }
    } catch (dbError) {
      console.log('⚠️ Database error, falling back to demo users:', dbError.message);
    }
    
    // Fallback to demo users
    const demoUser = demoUsers[email];
    if (!demoUser) {
      return res.status(401).json({ 
        status: "fail", 
        message: "דוא״ל או סיסמה שגויים" 
      });
    }
    
    if (password !== demoUser.password) {
      return res.status(401).json({ 
        status: "fail", 
        message: "דוא״ל או סיסמה שגויים" 
      });
    }
    
    console.log('✅ Demo user authenticated:', email);
    
    // Generate token for demo user
    const token = sign({ 
      id: demoUser.id, 
      email: email, 
      role: demoUser.role 
    });
    
    return res.status(200).json({
      status: "success",
      accessToken: token,
      user: {
        id: demoUser.id,
        email: email,
        firstName: demoUser.firstName,
        lastName: demoUser.lastName,
        role: demoUser.role,
        organizationId: null,
        mfaEnabled: false
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "שגיאה פנימית בשרת" 
    });
  }
};

// Get current user
exports.me = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        status: "fail", 
        message: "לא מורשה" 
      });
    }

    try {
      // Try database first
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user) {
        return res.status(200).json({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role
          }
        });
      }
    } catch (dbError) {
      console.log('⚠️ Database error in /me, using fallback:', dbError.message);
    }

    // Fallback - return user info from token
    return res.status(200).json({
      success: true,
      data: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName || 'משתמש',
        lastName: req.user.lastName || 'מקצועי',
        role: req.user.role || 'USER'
      }
    });

  } catch (error) {
    logger.error("Get user error:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "שגיאה פנימית בשרת" 
    });
  }
};

// Refresh token
exports.refresh = async (req, res) => {
  try {
    // Simple refresh - generate new token
    const token = sign({ 
      id: 'user-refresh-' + Date.now(), 
      email: 'user@example.com', 
      role: 'USER' 
    });

    return res.status(200).json({
      status: "success",
      accessToken: token
    });
  } catch (error) {
    logger.error("Refresh token error:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "שגיאה פנימית בשרת" 
    });
  }
};