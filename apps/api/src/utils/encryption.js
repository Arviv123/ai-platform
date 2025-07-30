const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const logger = require('./logger');

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
  saltLength: 64,
  iterations: 100000
};

class EncryptionService {
  constructor() {
    this.masterKey = this.getMasterKey();
  }

  // Get or generate master key
  getMasterKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY environment variable is required in production');
      }
      // Generate a key for development (not recommended for production)
      logger.warn('Using generated encryption key for development');
      return crypto.randomBytes(ENCRYPTION_CONFIG.keyLength);
    }
    return Buffer.from(key, 'hex');
  }

  // Derive key from master key and salt
  deriveKey(salt) {
    return crypto.pbkdf2Sync(
      this.masterKey,
      salt,
      ENCRYPTION_CONFIG.iterations,
      ENCRYPTION_CONFIG.keyLength,
      'sha512'
    );
  }

  // Encrypt sensitive data
  encrypt(plaintext) {
    try {
      if (!plaintext) return null;

      const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
      const key = this.deriveKey(salt);
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      
      const cipher = crypto.createCipher(ENCRYPTION_CONFIG.algorithm, key);
      cipher.setAAD(salt);

      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const tag = cipher.getAuthTag();

      // Combine salt + iv + tag + encrypted data
      const result = Buffer.concat([
        salt,
        iv,
        tag,
        encrypted
      ]);

      return result.toString('base64');

    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt sensitive data
  decrypt(encryptedData) {
    try {
      if (!encryptedData) return null;

      const data = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = data.slice(0, ENCRYPTION_CONFIG.saltLength);
      const iv = data.slice(
        ENCRYPTION_CONFIG.saltLength,
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength
      );
      const tag = data.slice(
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength,
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength
      );
      const encrypted = data.slice(
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength
      );

      const key = this.deriveKey(salt);
      
      const decipher = crypto.createDecipher(ENCRYPTION_CONFIG.algorithm, key);
      decipher.setAAD(salt);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, null, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Hash passwords with salt
  async hashPassword(password) {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  // Verify password
  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  // Generate secure random token
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate API key
  generateApiKey() {
    const prefix = 'aip'; // AI Platform prefix
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(20).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
  }

  // Hash API key for storage
  async hashApiKey(apiKey) {
    return await this.hashPassword(apiKey);
  }

  // Verify API key
  async verifyApiKey(apiKey, hash) {
    return await this.verifyPassword(apiKey, hash);
  }

  // Encrypt JSON data
  encryptJSON(data) {
    try {
      const jsonString = JSON.stringify(data);
      return this.encrypt(jsonString);
    } catch (error) {
      logger.error('JSON encryption error:', error);
      throw new Error('Failed to encrypt JSON data');
    }
  }

  // Decrypt JSON data
  decryptJSON(encryptedData) {
    try {
      const jsonString = this.decrypt(encryptedData);
      return JSON.parse(jsonString);
    } catch (error) {
      logger.error('JSON decryption error:', error);
      throw new Error('Failed to decrypt JSON data');
    }
  }

  // Encrypt database field
  encryptField(value) {
    if (value === null || value === undefined) return value;
    return this.encrypt(String(value));
  }

  // Decrypt database field
  decryptField(encryptedValue) {
    if (encryptedValue === null || encryptedValue === undefined) return encryptedValue;
    return this.decrypt(encryptedValue);
  }

  // Generate encryption key for new environments
  static generateMasterKey() {
    return crypto.randomBytes(ENCRYPTION_CONFIG.keyLength).toString('hex');
  }

  // Data anonymization for GDPR compliance
  anonymizeData(data) {
    const anonymized = { ...data };
    
    // Fields to anonymize
    const sensitiveFields = [
      'email', 'firstName', 'lastName', 'phone', 'address',
      'ipAddress', 'userAgent', 'personalData'
    ];

    sensitiveFields.forEach(field => {
      if (anonymized[field]) {
        anonymized[field] = this.generateAnonymizedValue(field, anonymized[field]);
      }
    });

    return anonymized;
  }

  // Generate anonymized value
  generateAnonymizedValue(fieldType, originalValue) {
    switch (fieldType) {
      case 'email':
        return `user${crypto.randomBytes(4).toString('hex')}@anonymized.com`;
      case 'firstName':
      case 'lastName':
        return `Anonymous${crypto.randomBytes(2).toString('hex')}`;
      case 'phone':
        return '+1-XXX-XXX-XXXX';
      case 'ipAddress':
        return '127.0.0.1';
      case 'userAgent':
        return 'Anonymized User Agent';
      default:
        return `[ANONYMIZED-${crypto.randomBytes(4).toString('hex').toUpperCase()}]`;
    }
  }

  // Secure data wipe
  secureWipe(data) {
    if (typeof data === 'string') {
      // Overwrite string memory (limited effectiveness in JavaScript)
      const length = data.length;
      data = null;
      return '0'.repeat(length);
    }
    
    if (Buffer.isBuffer(data)) {
      crypto.randomFillSync(data);
      return data;
    }

    return null;
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

// Export methods
module.exports = {
  encrypt: (data) => encryptionService.encrypt(data),
  decrypt: (data) => encryptionService.decrypt(data),
  hashPassword: (password) => encryptionService.hashPassword(password),
  verifyPassword: (password, hash) => encryptionService.verifyPassword(password, hash),
  generateSecureToken: (length) => encryptionService.generateSecureToken(length),
  generateApiKey: () => encryptionService.generateApiKey(),
  hashApiKey: (apiKey) => encryptionService.hashApiKey(apiKey),
  verifyApiKey: (apiKey, hash) => encryptionService.verifyApiKey(apiKey, hash),
  encryptJSON: (data) => encryptionService.encryptJSON(data),
  decryptJSON: (data) => encryptionService.decryptJSON(data),
  encryptField: (value) => encryptionService.encryptField(value),
  decryptField: (value) => encryptionService.decryptField(value),
  anonymizeData: (data) => encryptionService.anonymizeData(data),
  secureWipe: (data) => encryptionService.secureWipe(data),
  generateMasterKey: EncryptionService.generateMasterKey,
  
  // Constants
  ENCRYPTION_CONFIG
};