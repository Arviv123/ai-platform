const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");

const prisma = new PrismaClient();

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET || "dev-secret", { expiresIn: "7d" });

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

    // Check if user already exists
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

    // Get credits for subscription
    const subscriptionCredits = {
      free: 100,
      basic: 1000,
      premium: 5000,
      enterprise: 20000
    };

    // Create user
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        emailVerified: true
      }
    });

    logger.info(`New user registered: ${email}`);

    // Generate tokens
    const accessToken = sign({ 
      sub: user.id, 
      email: user.email,
      type: "access",
      role: user.role 
    });

    const refreshToken = sign({ 
      sub: user.id, 
      type: "refresh" 
    });

    res.json({
      status: "success",
      message: "נרשמת בהצלחה!",
      accessToken: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    logger.error("Registration error:", error);
    res.status(500).json({ 
      status: "error", 
      message: "שגיאה בהרשמה" 
    });
  }
};

// User login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ 
        status: "fail", 
        message: "יש להזין דוא״ל וסיסמה" 
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ 
        status: "fail", 
        message: "דוא״ל או סיסמה שגויים" 
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ 
        status: "fail", 
        message: "דוא״ל או סיסמה שגויים" 
      });
    }

    // User is active by default (no status field in schema)

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    logger.info(`User logged in: ${email}`);

    // Generate tokens
    const accessToken = sign({ 
      sub: user.id, 
      email: user.email,
      type: "access",
      role: user.role 
    });

    const refreshToken = sign({ 
      sub: user.id, 
      type: "refresh" 
    });

    res.json({
      status: "success",
      message: "התחברת בהצלחה!",
      accessToken: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({ 
      status: "error", 
      message: "שגיאה בהתחברות" 
    });
  }
};

// Get current user info
exports.me = async (req, res) => {
  try {
    const userId = req.user.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        subscription: true,
        credits: true,
        role: true,
        status: true,
        createdAt: true,
        lastLogin: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        status: "fail", 
        message: "משתמש לא נמצא" 
      });
    }

    res.json({
      status: "success",
      user
    });

  } catch (error) {
    logger.error("Get user error:", error);
    res.status(500).json({ 
      status: "error", 
      message: "שגיאה בטעינת פרטי משתמש" 
    });
  }
};

// Refresh token
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Refresh token required" 
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || "dev-secret");
    
    if (decoded.type !== 'refresh') {
      return res.status(400).json({ 
        status: "fail", 
        message: "Invalid token type" 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub }
    });

    if (!user) {
      return res.status(401).json({ 
        status: "fail", 
        message: "משתמש לא נמצא" 
      });
    }

    const newAccessToken = sign({ 
      sub: user.id, 
      email: user.email,
      type: "access",
      role: user.role 
    });

    res.json({
      status: "success",
      token: newAccessToken
    });

  } catch (error) {
    logger.error("Token refresh error:", error);
    res.status(401).json({ 
      status: "fail", 
      message: "Token לא תקין" 
    });
  }
};

// Logout
exports.logout = (req, res) => {
  res.json({
    status: "success",
    message: "התנתקת בהצלחה"
  });
};
