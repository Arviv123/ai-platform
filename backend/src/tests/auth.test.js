const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');

describe('Authentication Endpoints', () => {
  let authToken;
  let testUser;

  beforeAll(() => {
    // Mock user for testing
    testUser = {
      email: 'test@example.com',
      password: 'testpassword123',
      name: 'Test User'
    };
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      
      // Verify token structure
      const decodedToken = jwt.decode(response.body.accessToken);
      expect(decodedToken).toHaveProperty('sub', testUser.email);
      expect(decodedToken).toHaveProperty('type', 'access');
    });

    it('should fail with missing email', async () => {
      const invalidUser = { ...testUser };
      delete invalidUser.email;

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('email');
    });

    it('should fail with missing password', async () => {
      const invalidUser = { ...testUser };
      delete invalidUser.password;

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'fail');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('password');
    });

    it('should fail with invalid email format', async () => {
      const invalidUser = { ...testUser, email: 'invalid-email' };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'fail');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Register user first for login tests
      await request(app)
        .post('/api/auth/register')
        .send(testUser);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');

      authToken = response.body.accessToken;
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('status', 'fail');
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body).toHaveProperty('status', 'fail');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user info with valid token', async () => {
      if (!authToken) {
        // Get token if not available
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password
          });
        authToken = loginResponse.body.accessToken;
      }

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Token Validation', () => {
    it('should create valid JWT tokens', () => {
      const payload = { sub: 'user@example.com', type: 'access' };
      const secret = process.env.JWT_SECRET || 'dev-secret';
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      const decoded = jwt.verify(token, secret);
      expect(decoded).toHaveProperty('sub', payload.sub);
      expect(decoded).toHaveProperty('type', payload.type);
    });

    it('should reject expired tokens', () => {
      const payload = { sub: 'user@example.com', type: 'access' };
      const secret = process.env.JWT_SECRET || 'dev-secret';
      const token = jwt.sign(payload, secret, { expiresIn: '-1h' }); // Expired

      expect(() => {
        jwt.verify(token, secret);
      }).toThrow();
    });
  });
});