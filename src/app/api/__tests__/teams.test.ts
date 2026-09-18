/**
 * Integration tests for team creation API
 * @jest-environment node
 */
import { POST } from '../teams/route';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/authGuards', () => ({
  assertAuthenticated: jest.fn(),
  isAuthFailure: (r: { ok: boolean }) => !r.ok,
}));

jest.mock('@/lib/repositories/teamsRepo', () => ({
  createTeam: jest.fn(),
}));

jest.mock('@/lib/repositories/divisionsRepo', () => ({
  listDivisions: jest.fn(async () => [
    { id: '1', sport: 'basketball', slug: 'low_b', name: 'Low B', sortOrder: 0 },
    { id: '2', sport: 'basketball', slug: 'high_b', name: 'High B', sortOrder: 1 },
    { id: '3', sport: 'basketball', slug: 'a', name: 'A', sortOrder: 2 },
  ]),
  isKnownDivisionSlug: jest.fn(async (slug: string) =>
    ['low_b', 'high_b', 'a'].includes(slug)
  ),
  slugifyDivisionName: jest.fn((name: string) =>
    String(name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  ),
}));

jest.mock('@/lib/db/resolveLeague', () => ({
  resolveLeagueByRef: jest.fn(),
  leaguePublicRef: jest.fn((league: { slug: string }) => league.slug),
}));

import { assertAuthenticated } from '@/lib/authGuards';
import { createTeam } from '@/lib/repositories/teamsRepo';
import { resolveLeagueByRef } from '@/lib/db/resolveLeague';

const mockUser = {
  id: 'user123',
  email: 'test@example.com',
  superadmin: false,
};

describe('/api/teams POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (assertAuthenticated as jest.Mock).mockResolvedValue({ ok: true, user: mockUser });
    (resolveLeagueByRef as jest.Mock).mockResolvedValue(null);
    (createTeam as jest.Mock).mockImplementation(async (input) => ({
      id: input.id,
      name: input.name,
      description: input.description,
      leagueId: input.leagueSlug,
      approved: false,
      sport: input.sport,
      gender: input.gender,
      estimatedDivision: input.estimatedDivision,
      paymentRequired: input.paymentRequired,
      managerUserId: input.managerUserId,
    }));
  });

  it('rejects requests without authentication', async () => {
    (assertAuthenticated as jest.Mock).mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Team' }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('rejects requests without team name (after trim)', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Team',
        description: 'Test description',
        sport: 'basketball',
        gender: 'mens',
        estimatedDivision: 'high b',
        preferredPracticeDays: ['mon', 'fri', 'nope'],
        teamPaymentRequired: true,
      }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(200);
    const { ok, team } = await res.json();

    expect(ok).toBe(true);
    expect(team.name).toBe('Test Team');
    expect(team.managerUserId).toBe('user123');
    expect(team.leagueId).toBe(null);
    expect(team.teamPaymentRequired).toBe(true);
    expect(team.estimatedDivision).toBe('high_b');

    expect(createTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Team',
        managerUserId: 'user123',
        leagueSlug: null,
        paymentRequired: true,
        estimatedDivision: 'high_b',
      })
    );
  });

  it('creates team with league assignment (resolved by slug)', async () => {
    (resolveLeagueByRef as jest.Mock).mockImplementation(async (ref: string) => {
      if (ref.toLowerCase() === '4v4') {
        return { id: 'uuid-4v4', slug: '4v4', name: '4v4' };
      }
      return null;
    });

    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'League Team',
        division: '4V4',
      }),
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(200);
    const { team } = await res.json();

    expect(team.leagueId).toBe('4v4');
    expect(createTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        leagueSlug: '4v4',
        name: 'League Team',
      })
    );
  });

  it('rejects invalid league (BAD_LEAGUE)', async () => {
    const req = new Request('http://localhost/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Team',
        sport: 'quidditch',
      } as any),
    });

    const res = await POST(req as NextRequest);
    const { team } = await res.json();
    expect(team.sport).toBe('basketball');
    expect(team.gender).toBe('co-ed');
    expect(team.estimatedDivision).toBe('low_b');
  });
});
