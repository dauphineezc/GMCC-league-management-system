/**
 * Integration tests for team creation API
 * These tests mock the KV database to avoid external dependencies
 */
import { POST } from '../teams/route';
import type { NextRequest } from 'next/server';

// Mock KV
jest.mock('@vercel/kv', () => ({
  kv: {
    set: jest.fn().mockResolvedValue('OK'),
    sadd: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue([]),
  },
}));

// Mock memberships
jest.mock('@/server/memberships', () => ({
  upsertMembership: jest.fn().mockResolvedValue(undefined),
}));

import { kv } from '@vercel/kv';
import { upsertMembership } from '@/server/memberships';

describe('/api/teams POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects requests without authentication', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Team' }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects requests without team name (after trim)', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user123',
      },
      body: JSON.stringify({ name: '   \n\t  ' }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('BAD_NAME');
  });

  it('creates team with valid data (unassigned league)', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user123',
      },
      body: JSON.stringify({
        name: 'Test Team',
        description: 'Test description',
        sport: 'basketball',
        gender: 'mens',
        estimatedDivision: 'high b',
        preferredPracticeDays: ['mon', 'fri', 'nope'], // 'nope' should be filtered out
        teamPaymentRequired: true,
      }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(200);
    const { ok, team } = await res.json();

    expect(ok).toBe(true);
    expect(team).toBeDefined();
    expect(team.name).toBe('Test Team');
    expect(team.description).toBe('Test description');
    expect(team.managerUserId).toBe('user123');
    expect(team.approved).toBe(false);
    expect(team.rosterLimit).toBe(8);
    expect(team.leagueId).toBe(null);
    expect(team.sport).toBe('basketball');
    expect(team.gender).toBe('mens');
    expect(team.estimatedDivision).toBe('high b');
    expect(team.preferredPracticeDays).toEqual(['mon', 'fri']);
    expect(team.teamPaymentRequired).toBe(true);

    // persisted records
    expect(kv.set).toHaveBeenCalledWith(
      expect.stringMatching(/^team:/),
      expect.objectContaining({
        name: 'Test Team',
        managerUserId: 'user123',
      })
    );
    expect(kv.sadd).toHaveBeenCalledWith('teams:index', expect.any(String));

    // roster bootstrap with manager
    expect(kv.set).toHaveBeenCalledWith(
      expect.stringMatching(/^team:.*:roster$/),
      expect.arrayContaining([
        expect.objectContaining({ userId: 'user123', isManager: true }),
      ])
    );

    // unassigned path writes membership directly under user, not upsertMembership
    expect(upsertMembership).not.toHaveBeenCalled();
    expect(kv.set).toHaveBeenCalledWith(
      `user:user123:memberships`,
      expect.arrayContaining([
        expect.objectContaining({ teamId: expect.any(String), isManager: true }),
      ])
    );
  });

  it('creates team with league assignment (division normalized, membership upserted)', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user123',
      },
      body: JSON.stringify({
        name: 'League Team',
        division: '4V4', // will normalize to '4v4'
      }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(200);
    const { team } = await res.json();

    expect(team.leagueId).toBe('4v4');

    // team indexed globally and under league
    expect(kv.sadd).toHaveBeenCalledWith('teams:index', team.id);
    expect(kv.sadd).toHaveBeenCalledWith(`league:4v4:teams`, team.id);

    // upsertMembership called with derived leagueName
    expect(upsertMembership).toHaveBeenCalledWith(
      'user123',
      expect.objectContaining({
        leagueId: '4v4',
        leagueName: '4v4', // from DIVISIONS
        teamId: team.id,
        teamName: 'League Team',
        isManager: true,
      })
    );
  });

  it('rejects invalid division (BAD_LEAGUE)', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user123',
      },
      body: JSON.stringify({
        name: 'Test Team',
        division: 'invalid-division',
      }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('BAD_LEAGUE');
  });

  it('sanitizes sport with default when invalid', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'user123',
      },
      body: JSON.stringify({
        name: 'Test Team',
        sport: 'quidditch',
      } as any),
    });

    const res = await POST(req as NextRequest);
    const { team } = await res.json();
    expect(team.sport).toBe('basketball'); // default
    expect(team.gender).toBe('co-ed');     // default
    expect(team.estimatedDivision).toBe('low b'); // default
  });

  it.todo('enforces one-team-per-league per user (not implemented in route yet)');
  it.todo('rejects overlong name/description if limits are added');
  it.todo('returns a clear error for malformed JSON payloads');
});