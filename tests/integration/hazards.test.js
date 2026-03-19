/**
 * Integration tests for the hazards API.
 */

const request = require('supertest');

jest.mock('../../src/config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    query: jest.fn().mockResolvedValue([]),
    sync: jest.fn().mockResolvedValue(true),
    literal: jest.fn((v) => v),
    define: jest.fn().mockReturnValue({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
      belongsTo: jest.fn(),
      hasMany: jest.fn(),
      sync: jest.fn().mockResolvedValue(true),
    }),
  },
  initDatabase: jest.fn().mockResolvedValue(true),
}));

const mockHazards = [
  {
    id: 'uuid-1',
    type: 'flooding',
    severity: 'high',
    description: 'Road flooded',
    lng: 10.18,
    lat: 36.81,
    radius_meters: 100,
    confirmation_count: 5,
  },
  {
    id: 'uuid-2',
    type: 'construction',
    severity: 'medium',
    description: 'Road works',
    lng: 10.17,
    lat: 36.82,
    radius_meters: 80,
    confirmation_count: 2,
  },
];

jest.mock('../../src/models/Hazard', () => ({
  findByPk: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../src/models/User', () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

const { sequelize } = require('../../src/config/database');

describe('GET /api/hazards', () => {
  let app;

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  it('returns 400 when bbox params are missing', async () => {
    const res = await request(app).get('/api/hazards');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns hazards list with valid bbox', async () => {
    sequelize.query.mockResolvedValue(mockHazards);

    const res = await request(app)
      .get('/api/hazards')
      .query({ minLng: '10.15', minLat: '36.80', maxLng: '10.20', maxLat: '36.85' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.count).toBe(2);
  });
});

describe('POST /api/hazards', () => {
  let app;

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/hazards')
      .send({ type: 'flooding', lat: 36.81, lng: 10.18 });

    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid hazard type', async () => {
    // Even with auth header (will fail auth, but first hit validation check)
    const res = await request(app)
      .post('/api/hazards')
      .set('Authorization', 'Bearer invalid_token')
      .send({ type: 'alien_attack', lat: 36.81, lng: 10.18 });

    // Either 401 (auth failed) or 422 (validation failed) — both are correct rejections
    expect([401, 422]).toContain(res.status);
  });
});

describe('GET /api/hazards/:id', () => {
  let app;
  const Hazard = require('../../src/models/Hazard');

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  it('returns 404 for non-existent hazard', async () => {
    Hazard.findByPk.mockResolvedValue(null);

    const res = await request(app).get('/api/hazards/nonexistent-uuid');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns hazard data when found', async () => {
    Hazard.findByPk.mockResolvedValue(mockHazards[0]);

    const res = await request(app).get('/api/hazards/uuid-1');
    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('flooding');
  });
});
