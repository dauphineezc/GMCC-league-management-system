import { DIVISIONS, normalizeDivision, isDivisionId, type DivisionId } from '../divisions';

describe('DIVISIONS constant', () => {
  it('should have the expected division IDs', () => {
    const divisionIds = DIVISIONS.map(d => d.id);
    expect(divisionIds).toContain('4v4b');
    expect(divisionIds).toContain('4v4');
    expect(divisionIds).toContain('4v4a');
    expect(divisionIds).toContain('4v4w');
    expect(divisionIds).toContain('5v5');
  });

  it('should have names for all divisions', () => {
    DIVISIONS.forEach(division => {
      expect(division.name).toBeTruthy();
      expect(typeof division.name).toBe('string');
    });
  });
});

describe('normalizeDivision', () => {
  it('should return exact division ID when input matches', () => {
    expect(normalizeDivision('4v4')).toBe('4v4');
    expect(normalizeDivision('4v4b')).toBe('4v4b');
    expect(normalizeDivision('4v4a')).toBe('4v4a');
    expect(normalizeDivision('4v4w')).toBe('4v4w');
    expect(normalizeDivision('5v5')).toBe('5v5');
  });

  it('should handle case-insensitive aliases', () => {
    expect(normalizeDivision('4V4')).toBe('4v4');
    expect(normalizeDivision('4V4B')).toBe('4v4b');
    expect(normalizeDivision('5V5')).toBe('5v5');
  });

  it('should handle mixed case aliases', () => {
    expect(normalizeDivision('4V4b')).toBe('4v4b');
    expect(normalizeDivision('4v4 Women')).toBe('4v4w');
    expect(normalizeDivision('4V4 Women')).toBe('4v4w');
  });

  it('should return null for invalid division', () => {
    expect(normalizeDivision('invalid')).toBe(null);
    expect(normalizeDivision('6v6')).toBe(null);
    expect(normalizeDivision('')).toBe(null);
  });

  it('should trim whitespace', () => {
    expect(normalizeDivision('  4v4  ')).toBe('4v4');
    expect(normalizeDivision(' 4v4w ')).toBe('4v4w');
  });

  it('should handle null and undefined', () => {
    expect(normalizeDivision(null as any)).toBe(null);
    expect(normalizeDivision(undefined as any)).toBe(null);
  });
});

describe('isDivisionId', () => {
  it('should return true for valid division IDs', () => {
    expect(isDivisionId('4v4')).toBe(true);
    expect(isDivisionId('4v4b')).toBe(true);
    expect(isDivisionId('4v4a')).toBe(true);
    expect(isDivisionId('4v4w')).toBe(true);
    expect(isDivisionId('5v5')).toBe(true);
  });

  it('should return false for invalid division IDs', () => {
    expect(isDivisionId('invalid')).toBe(false);
    expect(isDivisionId('4V4')).toBe(false);
    expect(isDivisionId('')).toBe(false);
    expect(isDivisionId('6v6')).toBe(false);
  });

  it('should work as a type guard', () => {
    const testId: string = '4v4';
    if (isDivisionId(testId)) {
      // This should not error if type guard works
      const validId: DivisionId = testId;
      expect(validId).toBe('4v4');
    }
  });
});

