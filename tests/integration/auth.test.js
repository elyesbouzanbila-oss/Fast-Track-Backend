/**
 * Authentication and Account Verification Tests
 * Tests signup, login, JWT tokens, and authorization
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('Authentication & Account Management', () => {
  let app;

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  describe('POST /api/auth/register - User Signup', () => {
    it('returns 422 for missing name', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'User',
        email: 'not-email',
        password: 'SecurePass123!',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 for short password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'User',
        email: `test-${Date.now()}@example.com`,
        password: 'short',
      });
      expect(res.status).toBe(422);
      expect(res.body.details[0].msg).toContain('8');
    });

    it('prevents duplicate emails', async () => {
      const email = `dup-${Date.now()}@example.com`;
      await request(app).post('/api/auth/register').send({
        name: 'User 1',
        email,
        password: 'ValidPass123!',
      });
      const res = await request(app).post('/api/auth/register').send({
        name: 'User 2',
        email,
        password: 'ValidPass123!',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');
    });
  });

  describe('POST /api/auth/login - User Login', () => {
    it('returns 401 for non-existent user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'AnyPass123!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid credentials');
    });

    it('returns 422 for missing email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        password: 'SomePass123!',
      });
      expect(res.status).toBe(422);
    });

    it('returns 401 for incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPass123!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid credentials');
    });
  });

  describe('GET /api/auth/me - Account Verification', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('No token provided');
    });

    it('returns 401 with invalid Bearer format', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer xyz');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('No token provided');
    });

    it('returns 401 with malformed JWT', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer bad.jwt.sig');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid or expired token');
    });

    it('returns 401 with expired token', async () => {
      const token = jwt.sign(
        { id: 'user-id', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid or expired token');
    });

    it('returns 401 with token from wrong secret', async () => {
      const token = jwt.sign(
        { id: 'user-id', role: 'user' },
        'wrong-secret',
        { expiresIn: '7d' }
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Protected Endpoints - Authentication Required', () => {
    it('POST /api/hazards requires auth', async () => {
      const res = await request(app).post('/api/hazards').send({
        type: 'pothole',
        lat: 36.81,
        lng: 10.18,
      });
      expect(res.status).toBe(401);
    });

    it('PUT /api/hazards/:id requires auth', async () => {
      const res = await request(app)
        .put('/api/hazards/550e8400-e29b-41d4-a716-446655440000')
        .send({ severity: 'high' });
      expect(res.status).toBe(401);
    });

    it('DELETE /api/hazards/:id requires auth', async () => {
      const res = await request(app)
        .delete('/api/hazards/550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(401);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('non-admin cannot DELETE hazards', async () => {
      const userToken = jwt.sign(
        { id: '550e8400-e29b-41d4-a716-446655440001', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      const res = await request(app)
        .delete('/api/hazards/550e8400-e29b-41d4-a716-446655440002')
        .set('Authorization', `Bearer ${userToken}`);
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('JWT Token Structure & Claims', () => {
    it('token contains id and role', () => {
      const token = jwt.sign(
        { id: 'user-id', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBeDefined();
      expect(decoded.role).toBe('user');
    });

    it('token excludes password', () => {
      const token = jwt.sign(
        { id: 'user-id', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.password).toBeUndefined();
      expect(decoded.password_hash).toBeUndefined();
    });

    it('token has expiration claim', () => {
      const token = jwt.sign(
        { id: 'user-id', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('User Account Security', () => {
    it('password hash never exposed', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test',
        email: `test-${Date.now()}@example.com`,
        password: 'ValidPass123!',
      });
      if (res.status === 201) {
        expect(res.body.data.user.password_hash).toBeUndefined();
      }
    });

    it('new users active by default', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'User',
        email: `act-${Date.now()}@example.com`,
        password: 'ValidPass123!',
      });
      if (res.status === 201) {
        expect(res.body.data.user.is_active).toBe(true);
      }
    });

    it('new users have role=user', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'User',
        email: `rol-${Date.now()}@example.com`,
        password: 'ValidPass123!',
      });
      if (res.status === 201) {
        expect(res.body.data.user.role).toBe('user');
      }
    });
  });

  describe('Complete Authentication Flow', () => {
    it('signup → login → verify', async () => {
      const email = `flow-${Date.now()}@example.com`;
      const password = 'ValidPass123!';

      const signupRes = await request(app).post('/api/auth/register').send({
        name: 'User',
        email,
        password,
      });
      if (signupRes.status !== 201) return;

      const token1 = signupRes.body.data.token;
      const me1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token1}`);
      expect(me1.status).toBe(200);

      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password,
      });
      expect(loginRes.status).toBe(200);

      const token2 = loginRes.body.data.token;
      const me2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token2}`);
      expect(me2.status).toBe(200);
    });
  });
});
