const request = require('supertest');
const app = require('../index');
const jwt = require('jsonwebtoken');

describe('Chat Endpoints', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user and get auth token
    testUser = {
      email: 'chattest@example.com',
      password: 'testpassword123',
      name: 'Chat Test User'
    };

    // Register user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    authToken = registerResponse.body.accessToken;
  });

  describe('POST /api/chat', () => {
    it('should send a message to AI with valid token', async () => {
      const chatMessage = {
        message: 'Hello, how are you?',
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatMessage)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('model', chatMessage.model);
      expect(response.body).toHaveProperty('tokensUsed');
      expect(response.body).toHaveProperty('creditsUsed');
    });

    it('should fail without authentication', async () => {
      const chatMessage = {
        message: 'Hello, how are you?',
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .send(chatMessage)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should fail with empty message', async () => {
      const chatMessage = {
        message: '',
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatMessage)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'fail');
    });

    it('should fail with missing message', async () => {
      const chatMessage = {
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatMessage)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'fail');
    });

    it('should use default model when not specified', async () => {
      const chatMessage = {
        message: 'What is the weather like?'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatMessage)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('model');
    });

    it('should handle long messages', async () => {
      const longMessage = 'This is a very long message. '.repeat(100);
      const chatMessage = {
        message: longMessage,
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatMessage)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.tokensUsed).toBeGreaterThan(0);
    });

    it('should handle different AI models', async () => {
      const models = ['claude-3-haiku', 'claude-3-sonnet', 'gpt-3.5-turbo', 'gpt-4'];
      
      for (const model of models) {
        const chatMessage = {
          message: `Hello from ${model}!`,
          model: model
        };

        const response = await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send(chatMessage);

        // Should either succeed or fail gracefully (if API key not configured)
        expect([200, 500]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.body).toHaveProperty('status', 'success');
          expect(response.body).toHaveProperty('model', model);
        }
      }
    });

    it('should track credits usage', async () => {
      const chatMessage = {
        message: 'This message should use some credits.',
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatMessage)
        .expect(200);

      expect(response.body).toHaveProperty('creditsUsed');
      expect(response.body.creditsUsed).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('remainingCredits');
    });
  });

  describe('GET /api/chat/history', () => {
    beforeAll(async () => {
      // Send a few messages to create history
      const messages = [
        'What is AI?',
        'How does machine learning work?',
        'Explain neural networks'
      ];

      for (const message of messages) {
        await request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ message, model: 'claude-3-haiku' });
      }
    });

    it('should return chat history with valid token', async () => {
      const response = await request(app)
        .get('/api/chat/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/chat/history')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/chat/history?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 2);
    });
  });

  describe('DELETE /api/chat/:id', () => {
    let chatId;

    beforeAll(async () => {
      // Create a chat session to delete
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Message to be deleted', model: 'claude-3-haiku' });
      
      chatId = response.body.chatId || 'test-chat-id';
    });

    it('should delete chat session with valid token', async () => {
      const response = await request(app)
        .delete(`/api/chat/${chatId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('message');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .delete(`/api/chat/${chatId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle non-existent chat ID', async () => {
      const response = await request(app)
        .delete('/api/chat/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('status', 'fail');
    });
  });

  describe('Chat Input Validation', () => {
    it('should sanitize malicious input', async () => {
      const maliciousMessage = {
        message: '<script>alert("xss")</script>Hello AI',
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousMessage)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      // The response should not contain the script tag
      expect(response.body.response).not.toContain('<script>');
    });

    it('should handle very long messages gracefully', async () => {
      const veryLongMessage = {
        message: 'A'.repeat(10000), // 10KB message
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(veryLongMessage);

      // Should either succeed or fail with appropriate error
      expect([200, 400, 413]).toContain(response.status);
    });

    it('should handle special characters', async () => {
      const specialMessage = {
        message: 'שלום! こんにちは! 🤖 Testing émojis and ünïcödë',
        model: 'claude-3-haiku'
      };

      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(specialMessage)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting for chat requests', async () => {
      const promises = [];
      
      // Send multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ message: `Rate limit test ${i}`, model: 'claude-3-haiku' })
        );
      }

      const responses = await Promise.allSettled(promises);
      const statuses = responses.map(r => r.value?.status || r.reason?.status);

      // Some requests should succeed, others might be rate limited
      expect(statuses).toContain(200);
      // Rate limiting might return 429 if limits are exceeded
    });
  });
});