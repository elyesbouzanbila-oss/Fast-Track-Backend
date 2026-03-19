/**
 * Integration tests for the routing API endpoints.
 *
 * These tests require:
 *   - A running PostgreSQL + PostGIS instance
 *   - OSRM routing servers (mocked here for CI)
 *
 * Run with: npm run test:integration
 */

const request = require('supertest');

// Mock OSRM axios calls so tests don't need live OSRM servers
jest.mock('axios');
const axios = require('axios');

// Mock database
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

// Mock models
jest.mock('../../src/models/User', () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../src/models/Hazard', () => ({
  findAll: jest.fn().mockResolvedValue([]),
  create: jest.fn(),
}));

// Minimal OSRM nearest response (valid road snap)
const mockNearestResponse = {
  code: 'Ok',
  waypoints: [{ location: [10.1815, 36.8065], distance: 3.2, name: 'Test Street' }],
};

// Minimal OSRM route response
const mockRouteResponse = {
  code: 'Ok',
  routes: [{
    distance: 2340,
    duration: 420,
    geometry: {
      type: 'LineString',
      coordinates: [[10.1815, 36.8065], [10.1700, 36.8100], [10.1658, 36.8190]],
    },
    legs: [{ distance: 2340, duration: 420, steps: [] }],
  }],
};

describe('POST /api/route', () => {
  let app;

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  beforeEach(() => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/nearest/')) return Promise.resolve({ data: mockNearestResponse });
      if (url.includes('/route/')) return Promise.resolve({ data: mockRouteResponse });
      return Promise.reject(new Error('Unexpected URL: ' + url));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 422 when origin is missing', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({ destination: { lat: 36.819, lng: 10.165 } });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 when lat/lng are out of range', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        origin: { lat: 999, lng: 10.18 }, // invalid lat
        destination: { lat: 36.819, lng: 10.165 },
      });

    expect(res.status).toBe(422);
  });

  it('returns 422 for unknown routing mode', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        origin: { lat: 36.806, lng: 10.181 },
        destination: { lat: 36.819, lng: 10.165 },
        mode: 'helicopter',
      });

    expect(res.status).toBe(422);
  });

  it('returns a successful car route', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        origin: { lat: 36.8065, lng: 10.1815 },
        destination: { lat: 36.8190, lng: 10.1658 },
        mode: 'car',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.route.mode).toBe('car');
    expect(res.body.data.route.distance).toBe(2340);
    expect(res.body.data.route.geometry.type).toBe('LineString');
  });

  it('returns a successful walking route', async () => {
    const res = await request(app)
      .post('/api/route')
      .send({
        origin: { lat: 36.8065, lng: 10.1815 },
        destination: { lat: 36.8190, lng: 10.1658 },
        mode: 'foot',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.route.mode).toBe('foot');
  });
});

describe('GET /api/route/snap', () => {
  let app;

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  it('returns 422 for missing parameters', async () => {
    const res = await request(app).get('/api/route/snap');
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid lat/lng', async () => {
    const res = await request(app).get('/api/route/snap?lat=999&lng=10.18');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/health', () => {
  let app;

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /', () => {
  let app;

  beforeAll(async () => {
    const module = require('../../src/app');
    app = module.app;
    await module.init();
  });

  it('returns API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Navigation API');
  });
});
