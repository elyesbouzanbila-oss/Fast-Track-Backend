const {
  haversineDistance,
  walkingDuration,
  drivingDuration,
  formatDistance,
  formatDuration,
  lineStringLength,
  isInBbox,
} = require('../../src/utils/distance');

describe('distance utilities', () => {
  describe('haversineDistance', () => {
    it('returns 0 for identical points', () => {
      expect(haversineDistance(36.8065, 10.1815, 36.8065, 10.1815)).toBe(0);
    });

    it('calculates distance between two Tunis landmarks (~2.3km)', () => {
      // Avenue Habib Bourguiba to Bardo Museum
      const dist = haversineDistance(36.7975, 10.1808, 36.8190, 10.1328);
      expect(dist).toBeGreaterThan(4000);
      expect(dist).toBeLessThan(6000);
    });

    it('is symmetric', () => {
      const d1 = haversineDistance(36.8065, 10.1815, 36.8190, 10.1658);
      const d2 = haversineDistance(36.8190, 10.1658, 36.8065, 10.1815);
      expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
    });
  });

  describe('walkingDuration', () => {
    it('estimates ~119s for 166m (2 minutes walk)', () => {
      // 166m / 1.4 m/s ≈ 119s
      expect(walkingDuration(166)).toBe(119);
    });

    it('returns 0 for 0 meters', () => {
      expect(walkingDuration(0)).toBe(0);
    });
  });

  describe('drivingDuration', () => {
    it('estimates roughly correct driving time', () => {
      // 1000m at 8.33 m/s ≈ 120s
      const duration = drivingDuration(1000);
      expect(duration).toBeGreaterThan(100);
      expect(duration).toBeLessThan(140);
    });
  });

  describe('formatDistance', () => {
    it('formats meters below 1000 as Xm', () => {
      expect(formatDistance(500)).toBe('500m');
      expect(formatDistance(999)).toBe('999m');
    });

    it('formats meters above 1000 as X.Xkm', () => {
      expect(formatDistance(1000)).toBe('1.0km');
      expect(formatDistance(2500)).toBe('2.5km');
    });
  });

  describe('formatDuration', () => {
    it('formats seconds under 60 as Xs', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    it('formats 90 seconds as 1min', () => {
      expect(formatDuration(90)).toBe('1min');
    });

    it('formats 3661 seconds as 1h 1min', () => {
      expect(formatDuration(3661)).toBe('1h 1min');
    });
  });

  describe('isInBbox', () => {
    it('returns true for point inside bbox', () => {
      expect(isInBbox(36.81, 10.18, 36.80, 10.17, 36.82, 10.19)).toBe(true);
    });

    it('returns false for point outside bbox', () => {
      expect(isInBbox(37.00, 10.18, 36.80, 10.17, 36.82, 10.19)).toBe(false);
    });
  });

  describe('lineStringLength', () => {
    it('returns 0 for empty geometry', () => {
      expect(lineStringLength({ type: 'LineString', coordinates: [] })).toBe(0);
    });

    it('calculates length of a simple line', () => {
      const geojson = {
        type: 'LineString',
        coordinates: [
          [10.1815, 36.8065],
          [10.1658, 36.8190],
        ],
      };
      const length = lineStringLength(geojson);
      expect(length).toBeGreaterThan(1000);
      expect(length).toBeLessThan(3000);
    });
  });
});
