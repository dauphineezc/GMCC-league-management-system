/**
 * @jest-environment node
 */
jest.mock('@/db/index', () => ({ db: {} }));

import {
  clampInviteTtlHours,
  DEFAULT_INVITE_TTL_HOURS,
  MAX_INVITE_TTL_HOURS,
} from '../repositories/invitesRepo';

describe('clampInviteTtlHours', () => {
  it('keeps the values the invite modal offers', () => {
    expect(clampInviteTtlHours(12)).toBe(12);
    expect(clampInviteTtlHours(24)).toBe(24);
    expect(clampInviteTtlHours(48)).toBe(48);
  });

  it('caps long-lived invites', () => {
    expect(clampInviteTtlHours(1e9)).toBe(MAX_INVITE_TTL_HOURS);
    expect(clampInviteTtlHours(Infinity)).toBe(DEFAULT_INVITE_TTL_HOURS);
  });

  it('falls back to the default for missing or invalid values', () => {
    for (const v of [undefined, null, 0, -5, 'abc', NaN]) {
      expect(clampInviteTtlHours(v)).toBe(DEFAULT_INVITE_TTL_HOURS);
    }
    expect(clampInviteTtlHours('36')).toBe(36);
    expect(clampInviteTtlHours(2.7)).toBe(2);
  });
});
