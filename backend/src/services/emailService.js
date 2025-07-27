const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Email templates
const emailTemplates = {
  verification: {
    subject: 'Verify your email address',
    html: (name, token, verificationUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to AI Platform!</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          If you didn't create an account, you can safely ignore this email.
        </p>
      </div>
    `
  },
  
  passwordReset: {
    subject: 'Reset your password',
    html: (name, token, resetUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Hi ${name || 'there'},</p>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `
  },
  
  welcome: {
    subject: 'Welcome to AI Platform!',
    html: (name, credits) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to AI Platform!</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Your email has been verified successfully! You're now ready to start using our AI platform.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">🎉 Welcome Gift</h3>
          <p>We've added <strong>${credits} free credits</strong> to your account to get you started!</p>
        </div>
        <h3>What you can do now:</h3>
        <ul>
          <li>Start chatting with AI models like Claude and GPT</li>
          <li>Connect your custom MCP servers</li>
          <li>Create and manage prompt templates</li>
          <li>Explore advanced AI features</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Go to Dashboard
          </a>
        </div>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Happy coding!</p>
      </div>
    `
  },
  
  creditsPurchased: {
    subject: 'Credits Purchase Confirmation',
    html: (name, credits, amount, transactionId) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Credits Purchase Confirmation</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Thank you for your purchase! Your credits have been added to your account.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Purchase Details</h3>
          <p><strong>Credits Purchased:</strong> ${credits}</p>
          <p><strong>Amount Paid:</strong> $${amount}</p>
          <p><strong>Transaction ID:</strong> ${transactionId}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/dashboard" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Start Using Credits
          </a>
        </div>
      </div>
    `
  },
  
  lowCredits: {
    subject: 'Low Credits Warning',
    html: (name, remainingCredits) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Low Credits Warning</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Your account is running low on credits. You currently have <strong>${remainingCredits} credits</strong> remaining.</p>
        <p>To continue using our AI platform without interruption, consider purchasing more credits.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/billing" 
             style="background-color: #ffc107; color: #212529; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Purchase Credits
          </a>
        </div>
      </div>
    `
  }
};

// Create email transporter
const createTransporter = () => {
  if (process.env.NODE_ENV === 'development') {
    // Use Ethereal for development
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    });
  }

  // Production configuration
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransporter({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }

  // SMTP fallback
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send email function
const sendEmail = async (to, subject, html, text = null) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@aiplatform.com',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: info.messageId
    });

    // Log preview URL in development
    if (process.env.NODE_ENV === 'development') {
      logger.info('Email preview URL:', nodemailer.getTestMessageUrl(info));
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email', {
      to,
      subject,
      error: error.message
    });
    throw error;
  }
};

// Specific email functions
const sendVerificationEmail = async (email, name, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const template = emailTemplates.verification;
  
  return sendEmail(
    email,
    template.subject,
    template.html(name, token, verificationUrl)
  );
};

const sendPasswordResetEmail = async (email, name, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const template = emailTemplates.passwordReset;
  
  return sendEmail(
    email,
    template.subject,
    template.html(name, token, resetUrl)
  );
};

const sendWelcomeEmail = async (email, name, credits = 1000) => {
  const template = emailTemplates.welcome;
  
  return sendEmail(
    email,
    template.subject,
    template.html(name, credits)
  );
};

const sendCreditsPurchasedEmail = async (email, name, credits, amount, transactionId) => {
  const template = emailTemplates.creditsPurchased;
  
  return sendEmail(
    email,
    template.subject,
    template.html(name, credits, amount, transactionId)
  );
};

const sendLowCreditsEmail = async (email, name, remainingCredits) => {
  const template = emailTemplates.lowCredits;
  
  return sendEmail(
    email,
    template.subject,
    template.html(name, remainingCredits)
  );
};

// Bulk email function
const sendBulkEmail = async (recipients, subject, html, text = null) => {
  const results = [];
  
  for (const recipient of recipients) {
    try {
      const result = await sendEmail(recipient.email, subject, html, text);
      results.push({ email: recipient.email, success: true, ...result });
    } catch (error) {
      results.push({ 
        email: recipient.email, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  logger.info('Bulk email completed', {
    total: recipients.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
  
  return results;
};

// Email queue for background processing
const emailQueue = [];
let isProcessingQueue = false;

const addToQueue = (emailData) => {
  emailQueue.push(emailData);
  processQueue();
};

const processQueue = async () => {
  if (isProcessingQueue || emailQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (emailQueue.length > 0) {
    const emailData = emailQueue.shift();
    
    try {
      await sendEmail(
        emailData.to,
        emailData.subject,
        emailData.html,
        emailData.text
      );
    } catch (error) {
      logger.error('Queue email failed', {
        to: emailData.to,
        subject: emailData.subject,
        error: error.message
      });
    }
    
    // Small delay to avoid overwhelming the email service
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  isProcessingQueue = false;
};

// Test email configuration
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration is valid');
    return true;
  } catch (error) {
    logger.error('Email configuration test failed:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendCreditsPurchasedEmail,
  sendLowCreditsEmail,
  sendBulkEmail,
  addToQueue,
  testEmailConfig,
  emailTemplates
};