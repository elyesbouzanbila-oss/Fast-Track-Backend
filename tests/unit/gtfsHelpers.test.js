const {
  gtfsTimeToSeconds,
  secondsToGtfsTime,
  getTransitTypeLabel,
  getTransitTypeIcon,
  formatGtfsTime,
  serviceRunsOnDate,
  calculateHeadways,
} = require('../../src/utils/gtfsHelpers');

describe('gtfsHelpers', () => {
  describe('gtfsTimeToSeconds', () => {
    it('converts normal time correctly', () => {
      expect(gtfsTimeToSeconds('08:30:00')).toBe(8 * 3600 + 30 * 60);
    });

    it('handles times past midnight (>24h)', () => {
      expect(gtfsTimeToSeconds('25:10:00')).toBe(25 * 3600 + 10 * 60);
    });

    it('handles missing seconds', () => {
      expect(gtfsTimeToSeconds('08:30')).toBe(8 * 3600 + 30 * 60);
    });

    it('returns null for null input', () => {
      expect(gtfsTimeToSeconds(null)).toBeNull();
    });
  });

  describe('secondsToGtfsTime', () => {
    it('converts seconds back to HH:MM:SS', () => {
      expect(secondsToGtfsTime(8 * 3600 + 30 * 60)).toBe('08:30:00');
    });

    it('handles past-midnight seconds', () => {
      expect(secondsToGtfsTime(25 * 3600 + 10 * 60)).toBe('25:10:00');
    });

    it('is inverse of gtfsTimeToSeconds', () => {
      const original = '14:45:30';
      expect(secondsToGtfsTime(gtfsTimeToSeconds(original))).toBe(original);
    });
  });

  describe('getTransitTypeLabel', () => {
    it('returns correct labels for known types', () => {
      expect(getTransitTypeLabel(0)).toBe('Tram');
      expect(getTransitTypeLabel(1)).toBe('Metro');
      expect(getTransitTypeLabel(2)).toBe('Train');
      expect(getTransitTypeLabel(3)).toBe('Bus');
    });

    it('returns generic label for unknown type', () => {
      expect(getTransitTypeLabel(99)).toBe('Transit');
    });
  });

  describe('getTransitTypeIcon', () => {
    it('returns correct emoji icons', () => {
      expect(getTransitTypeIcon(1)).toBe('🚇');
      expect(getTransitTypeIcon(3)).toBe('🚌');
      expect(getTransitTypeIcon(2)).toBe('🚆');
    });

    it('returns bus icon for unknown type', () => {
      expect(getTransitTypeIcon(99)).toBe('🚌');
    });
  });

  describe('formatGtfsTime', () => {
    it('formats normal time as HH:MM', () => {
      expect(formatGtfsTime('08:30:00')).toBe('08:30');
    });

    it('marks next-day times with (+1)', () => {
      expect(formatGtfsTime('25:10:00')).toBe('01:10 (+1)');
    });

    it('returns empty string for null', () => {
      expect(formatGtfsTime(null)).toBe('');
    });
  });

  describe('serviceRunsOnDate', () => {
    it('correctly identifies weekday service', () => {
      const calendar = {
        monday: '1', tuesday: '1', wednesday: '1',
        thursday: '1', friday: '1', saturday: '0', sunday: '0',
      };
      // A Monday
      const monday = new Date('2026-03-16');
      expect(serviceRunsOnDate(calendar, monday)).toBe(true);

      // A Saturday
      const saturday = new Date('2026-03-21');
      expect(serviceRunsOnDate(calendar, saturday)).toBe(false);
    });
  });

  describe('calculateHeadways', () => {
    it('returns null for single departure', () => {
      expect(calculateHeadways(['08:00:00'])).toBeNull();
    });

    it('calculates 30-minute headway correctly', () => {
      const times = ['08:00:00', '08:30:00', '09:00:00', '09:30:00'];
      const result = calculateHeadways(times);
      expect(result.min).toBe(30);
      expect(result.max).toBe(30);
      expect(result.avg).toBe(30);
    });

    it('calculates variable headways', () => {
      const times = ['08:00:00', '08:15:00', '09:00:00'];
      const result = calculateHeadways(times);
      expect(result.min).toBe(15);
      expect(result.max).toBe(45);
      expect(result.avg).toBe(30);
    });
  });
});
