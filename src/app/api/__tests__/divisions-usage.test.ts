/**
 * Tests for division utilities as used in API endpoints
 */
import { normalizeDivision, DIVISIONS, isDivisionId } from '@/lib/divisions';

describe('Division utilities in API context', () => {
  describe('normalizeDivision', () => {
    it('normalizes valid inputs and aliases', () => {
      expect(normalizeDivision('4v4')).toBe('4v4');
      expect(normalizeDivision('4V4')).toBe('4v4');   // alias
      expect(normalizeDivision('4v4b')).toBe('4v4b');
      expect(normalizeDivision('4V4B')).toBe('4v4b'); // alias
      expect(normalizeDivision('4v4 Women')).toBe('4v4w'); // alias
      expect(normalizeDivision('5V5')).toBe('5v5');   // alias
    });

    it('handles null/empty as unassigned', () => {
      expect(normalizeDivision('')).toBe(null);
      // Note: function expects string; route already calls String(rawDiv)
      // so we only test string inputs here.
    });

    it('trims whitespace before validating', () => {
      expect(normalizeDivision('  4V4  ')).toBe('4v4');
      expect(normalizeDivision('\n\t4V4B\t')).toBe('4v4b');
      expect(normalizeDivision('   ')).toBe(null);
    });

    it('returns null for unknown divisions', () => {
      expect(normalizeDivision('invalid')).toBe(null);
      expect(normalizeDivision('bad-division')).toBe(null);
    });
  });

  describe('DIVISIONS list integrity', () => {
    it('finds league names by ID', () => {
      const league = DIVISIONS.find(d => d.id === '4v4');
      expect(league?.name).toBe('4v4');
    });

    it('has unique IDs and truthy names', () => {
      const ids = DIVISIONS.map(d => d.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
      DIVISIONS.forEach(d => expect(Boolean(d.name)).toBe(true));
    });

    it('isDivisionId matches exactly and is case-sensitive', () => {
      for (const d of DIVISIONS) {
        expect(isDivisionId(d.id)).toBe(true);
      }
      expect(isDivisionId('4V4')).toBe(false);
      expect(isDivisionId(' 4v4 ')).toBe(false);
      expect(isDivisionId('nope')).toBe(false);
    });
  });
});