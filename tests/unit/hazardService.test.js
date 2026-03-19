/**
 * Unit tests for hazard service helper logic.
 * DB-dependent functions are mocked.
 */

// Mock the database module
jest.mock('../../src/config/database', () => ({
  sequelize: {
    query: jest.fn(),
    literal: jest.fn((v) => v),
    define: jest.fn().mockReturnValue({
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      belongsTo: jest.fn(),
      hasMany: jest.fn(),
      sync: jest.fn().mockResolvedValue(true),
    }),
  },
}));

jest.mock('../../src/models/Hazard', () => ({
  create: jest.fn(),
  update: jest.fn(),
  findByPk: jest.fn(),
}));

const { sequelize } = require('../../src/config/database');
const Hazard = require('../../src/models/Hazard');
const {
  createHazard,
  confirmHazard,
  checkRouteForHazards,
  getHazardsAlongRoute,
} = require('../../src/services/hazardService');

describe('hazardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createHazard', () => {
    it('creates a hazard with correct PostGIS Point geometry', async () => {
      const mockHazard = { id: 'uuid-1', type: 'flooding' };
      Hazard.create.mockResolvedValue(mockHazard);

      const result = await createHazard(
        { type: 'flooding', severity: 'high', lat: 36.81, lng: 10.18, radius_meters: 100 },
        'user-uuid-1'
      );

      expect(Hazard.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'flooding',
          severity: 'high',
          location: {
            type: 'Point',
            coordinates: [10.18, 36.81], // [lng, lat] — GeoJSON order
          },
          radius_meters: 100,
          reported_by: 'user-uuid-1',
        })
      );
      expect(result).toEqual(mockHazard);
    });

    it('uses default radius when not provided', async () => {
      Hazard.create.mockResolvedValue({});
      await createHazard({ type: 'pothole', lat: 36.81, lng: 10.18 }, 'user-1');
      expect(Hazard.create).toHaveBeenCalledWith(
        expect.objectContaining({ radius_meters: 50 })
      );
    });
  });

  describe('confirmHazard', () => {
    it('returns true when hazard is updated', async () => {
      Hazard.update = jest.fn().mockResolvedValue([1]);
      const result = await confirmHazard('hazard-uuid-1');
      expect(result).toBe(true);
    });

    it('returns false when hazard not found', async () => {
      Hazard.update = jest.fn().mockResolvedValue([0]);
      const result = await confirmHazard('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  describe('checkRouteForHazards', () => {
    it('returns hasCriticalHazards=true when critical hazards present', async () => {
      sequelize.query.mockResolvedValue([
        { id: '1', severity: 'critical', type: 'road_closure' },
        { id: '2', severity: 'medium', type: 'pothole' },
      ]);

      const mockGeometry = { type: 'LineString', coordinates: [[10.18, 36.80], [10.19, 36.81]] };
      const result = await checkRouteForHazards(mockGeometry);

      expect(result.hasHazards).toBe(true);
      expect(result.hasCriticalHazards).toBe(true);
      expect(result.criticalHazards).toHaveLength(1);
      expect(result.hazards).toHaveLength(2);
    });

    it('returns hasCriticalHazards=false when only low/medium hazards', async () => {
      sequelize.query.mockResolvedValue([
        { id: '1', severity: 'low', type: 'pothole' },
      ]);

      const mockGeometry = { type: 'LineString', coordinates: [[10.18, 36.80], [10.19, 36.81]] };
      const result = await checkRouteForHazards(mockGeometry);

      expect(result.hasHazards).toBe(true);
      expect(result.hasCriticalHazards).toBe(false);
    });

    it('returns hasHazards=false when no hazards on route', async () => {
      sequelize.query.mockResolvedValue([]);
      const mockGeometry = { type: 'LineString', coordinates: [[10.18, 36.80], [10.19, 36.81]] };
      const result = await checkRouteForHazards(mockGeometry);

      expect(result.hasHazards).toBe(false);
      expect(result.hasCriticalHazards).toBe(false);
    });
  });
});
