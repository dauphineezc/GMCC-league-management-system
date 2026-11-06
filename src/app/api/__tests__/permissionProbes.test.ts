/**
 * Permission probes: unprivileged callers must not reach privileged writes,
 * and privileged callers must still get through.
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('@/lib/firebaseAdmin', () => ({
  adminAuth: {
    getUserByEmail: jest.fn(async (email: string) => ({
      uid: 'attacker-uid',
      email,
      emailVerified: true,
    })),
    getUser: jest.fn(async (uid: string) => ({ uid, email: `${uid}@victim.test` })),
  },
}));

jest.mock('@/lib/serverUser', () => ({
  getServerUser: jest.fn(async () => null),
  isLeagueAdminAsync: jest.fn(async () => false),
}));

jest.mock('@/lib/authGuards', () => {
  const actual = jest.requireActual('@/lib/authGuards');
  return {
    ...actual,
    assertAuthenticated: jest.fn(),
    assertLeagueAdminForUser: jest.fn(),
  };
});

jest.mock('@/lib/permissions', () => ({
  PermissionChecker: {
    create: jest.fn(async () => ({ isAdmin: () => false, isSuperAdmin: () => false })),
  },
}));

jest.mock('@/lib/repositories/leaguesRepo', () => ({
  createLeagueRecord: jest.fn(async () => ({ slug: 'evil-league' })),
  readLeagueDocByRef: jest.fn(async () => ({ id: 'league-b', slug: 'league-b' })),
}));

jest.mock('@/lib/repositories/teamsRepo', () => ({
  assignTeamToLeagueRef: jest.fn(async () => ({ prevLeagueRef: null })),
  unassignTeamFromLeagueRef: jest.fn(async () => 'league-b'),
  listUnassignedTeams: jest.fn(async () => []),
  getTeamById: jest.fn(async () => ({ id: 'team-x', leagueId: 'league-b', name: 'X' })),
  toggleMemberPaid: jest.fn(),
  toggleTeamFeePaid: jest.fn(),
  getTeamRosterMeta: jest.fn(async () => ({
    roster: [
      { userId: 'real-manager', isManager: true },
      { userId: 'accomplice', isManager: false },
    ],
    size: 2,
    managerCount: 1,
  })),
  isUserTeamManager: jest.fn(async () => false),
  setTeamManager: jest.fn(),
}));

jest.mock('@/lib/repositories/divisionsRepo', () => ({
  isKnownDivisionSlug: jest.fn(async () => true),
}));

jest.mock('@/lib/repositories/usersRepo', () => ({
  upsertUserProfile: jest.fn(),
  getUserDoc: jest.fn(async () => null),
  readMembershipsForUid: jest.fn(async () => []),
}));

jest.mock('@/lib/db/resolveLeague', () => ({
  resolveLeagueByRef: jest.fn(async (ref: string) => ({ id: `uuid-${ref}`, slug: ref })),
}));

jest.mock('@/server/memberships', () => ({
  removePlayerFromTeam: jest.fn(),
}));

import { assertAuthenticated, assertLeagueAdminForUser } from '@/lib/authGuards';
import { getServerUser, isLeagueAdminAsync } from '@/lib/serverUser';
import { PermissionChecker } from '@/lib/permissions';
import { createLeagueRecord } from '@/lib/repositories/leaguesRepo';
import {
  assignTeamToLeagueRef,
  unassignTeamFromLeagueRef,
  toggleMemberPaid,
  toggleTeamFeePaid as toggleTeamFeePaidInDb,
  isUserTeamManager,
  setTeamManager,
} from '@/lib/repositories/teamsRepo';
import { removePlayerFromTeam } from '@/server/memberships';
import { readMembershipsForUid } from '@/lib/repositories/usersRepo';

const player = { id: 'outsider', email: 'outsider@example.com', superadmin: false };
const superadmin = { id: 'boss', email: 'boss@example.com', superadmin: true };

function leagueForm() {
  const fd = new FormData();
  fd.set('name', 'Evil League');
  fd.set('sport', 'basketball');
  fd.set('division', 'a');
  fd.set('gender', 'mens');
  fd.set('adminEmail', 'attacker@example.com');
  return fd;
}

beforeEach(() => {
  jest.clearAllMocks();
  (getServerUser as jest.Mock).mockResolvedValue(null);
  (isLeagueAdminAsync as jest.Mock).mockResolvedValue(false);
  (assertAuthenticated as jest.Mock).mockResolvedValue({ ok: true, user: player });
  (isUserTeamManager as jest.Mock).mockResolvedValue(false);
  (PermissionChecker.create as jest.Mock).mockResolvedValue({
    isAdmin: () => false,
    isSuperAdmin: () => false,
  });
});

describe('createLeagueAction / addTeamToLeagueDirect', () => {
  it.each([
    ['anonymous', null],
    ['a signed-in player', player],
  ])('rejects %s', async (_label, user) => {
    (getServerUser as jest.Mock).mockResolvedValue(user);
    const { createLeagueAction, addTeamToLeagueDirect } = await import(
      '@/app/(superadmin)/superadmin/leagues/createLeagueAction'
    );

    const created = await createLeagueAction(null, leagueForm());
    const added = await addTeamToLeagueDirect('league-b', 'team-x');

    expect(created).toMatchObject({ ok: false });
    expect(added).toMatchObject({ ok: false });
    expect(createLeagueRecord).not.toHaveBeenCalled();
    expect(assignTeamToLeagueRef).not.toHaveBeenCalled();
  });

  it('allows a superadmin', async () => {
    (getServerUser as jest.Mock).mockResolvedValue(superadmin);
    const { createLeagueAction, addTeamToLeagueDirect } = await import(
      '@/app/(superadmin)/superadmin/leagues/createLeagueAction'
    );

    await createLeagueAction(null, leagueForm());
    await addTeamToLeagueDirect('league-b', 'team-x');

    expect(createLeagueRecord).toHaveBeenCalled();
    expect(assignTeamToLeagueRef).toHaveBeenCalledWith('team-x', 'league-b');
  });

  it('refuses to make an unverified email the league admin', async () => {
    (getServerUser as jest.Mock).mockResolvedValue(superadmin);
    const { adminAuth } = jest.requireMock('@/lib/firebaseAdmin') as {
      adminAuth: { getUserByEmail: jest.Mock };
    };
    adminAuth.getUserByEmail.mockResolvedValueOnce({
      uid: 'squatter',
      email: 'attacker@example.com',
      emailVerified: false,
    });
    const { createLeagueAction } = await import(
      '@/app/(superadmin)/superadmin/leagues/createLeagueAction'
    );

    const res = await createLeagueAction(null, leagueForm());

    expect(res).toMatchObject({ ok: false });
    expect(createLeagueRecord).not.toHaveBeenCalled();
  });
});

describe('adminActions', () => {
  it.each([
    ['anonymous', null],
    ['a signed-in player', player],
  ])('rejects %s', async (_label, user) => {
    (getServerUser as jest.Mock).mockResolvedValue(user);
    const actions = await import('@/lib/adminActions');

    await expect(actions.toggleTeamFeePaid('team-x')).rejects.toThrow('Forbidden');
    await expect(actions.togglePlayerPaid('team-x', 'someone')).rejects.toThrow('Forbidden');
    await expect(actions.assignTeamToLeague('team-x', 'league-b')).rejects.toThrow('Forbidden');
    await expect(actions.unassignTeamFromLeague('team-x')).rejects.toThrow('Forbidden');

    expect(toggleTeamFeePaidInDb).not.toHaveBeenCalled();
    expect(toggleMemberPaid).not.toHaveBeenCalled();
    expect(assignTeamToLeagueRef).not.toHaveBeenCalled();
    expect(unassignTeamFromLeagueRef).not.toHaveBeenCalled();
  });

  it('lets a league admin toggle payments but not reassign teams', async () => {
    const leagueAdmin = { id: 'admin-b', email: 'b@example.com', superadmin: false };
    (getServerUser as jest.Mock).mockResolvedValue(leagueAdmin);
    (isLeagueAdminAsync as jest.Mock).mockImplementation(
      async (_u: unknown, leagueId: string) => leagueId === 'league-b'
    );
    const actions = await import('@/lib/adminActions');

    await actions.toggleTeamFeePaid('team-x');
    await actions.togglePlayerPaid('team-x', 'someone');
    await expect(actions.assignTeamToLeague('team-x', 'league-c')).rejects.toThrow('Forbidden');

    expect(toggleTeamFeePaidInDb).toHaveBeenCalledWith('team-x');
    expect(toggleMemberPaid).toHaveBeenCalledWith('team-x', 'someone');
    expect(assignTeamToLeagueRef).not.toHaveBeenCalled();
  });

  it('lets a superadmin run every action on a team assigned to a league', async () => {
    (getServerUser as jest.Mock).mockResolvedValue(superadmin);
    const actions = await import('@/lib/adminActions');

    await actions.toggleTeamFeePaid('team-x');
    await actions.togglePlayerPaid('team-x', 'someone');
    await actions.assignTeamToLeague('team-x', 'league-c');
    await actions.unassignTeamFromLeague('team-x');

    expect(isLeagueAdminAsync).not.toHaveBeenCalled();
    expect(toggleTeamFeePaidInDb).toHaveBeenCalledWith('team-x');
    expect(toggleMemberPaid).toHaveBeenCalledWith('team-x', 'someone');
    expect(assignTeamToLeagueRef).toHaveBeenCalledWith('team-x', 'league-c');
    expect(unassignTeamFromLeagueRef).toHaveBeenCalledWith('team-x');
  });

  it('rejects an admin of a different league', async () => {
    (getServerUser as jest.Mock).mockResolvedValue({ id: 'admin-a', email: null, superadmin: false });
    (isLeagueAdminAsync as jest.Mock).mockImplementation(
      async (_u: unknown, leagueId: string) => leagueId === 'league-a'
    );
    const actions = await import('@/lib/adminActions');

    await expect(actions.toggleTeamFeePaid('team-x')).rejects.toThrow('Forbidden');
    expect(toggleTeamFeePaidInDb).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/teams/[teamId]/players', () => {
  function removeRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/teams/team-x/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as unknown as NextRequest;
  }
  const ctx = { params: Promise.resolve({ teamId: 'team-x' }) };

  it('does not let a non-manager reassign the team manager via "self" removal', async () => {
    const { DELETE } = await import('../teams/[teamId]/players/route');
    const res = await DELETE(removeRequest({ userId: 'self', newManagerId: 'accomplice' }), ctx);

    expect(res.status).toBe(403);
    expect(setTeamManager).not.toHaveBeenCalled();
    expect(removePlayerFromTeam).not.toHaveBeenCalled();
  });

  it('still lets a non-manager leave without naming a manager', async () => {
    const { DELETE } = await import('../teams/[teamId]/players/route');
    const res = await DELETE(removeRequest({ userId: 'self' }), ctx);

    expect(res.status).toBe(200);
    expect(removePlayerFromTeam).toHaveBeenCalledWith('outsider', 'team-x');
  });

  it('lets the manager hand off the role when leaving', async () => {
    (assertAuthenticated as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'real-manager', email: null, superadmin: false },
    });
    (isUserTeamManager as jest.Mock).mockResolvedValue(true);
    const { DELETE } = await import('../teams/[teamId]/players/route');
    const res = await DELETE(removeRequest({ userId: 'self', newManagerId: 'accomplice' }), ctx);

    expect(res.status).toBe(200);
    expect(setTeamManager).toHaveBeenCalledWith('team-x', 'accomplice');
  });

  it('rejects promoting the player who is being removed', async () => {
    (assertAuthenticated as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'real-manager', email: null, superadmin: false },
    });
    (isUserTeamManager as jest.Mock).mockResolvedValue(true);
    const { DELETE } = await import('../teams/[teamId]/players/route');
    const res = await DELETE(
      removeRequest({ userId: 'accomplice', newManagerId: 'accomplice' }),
      ctx
    );

    expect(res.status).toBe(400);
    expect(setTeamManager).not.toHaveBeenCalled();
  });
});

describe('GET /api/users/[uid]/email', () => {
  async function getEmail(uid: string, query = '') {
    const { GET } = await import('../users/[uid]/email/route');
    const req = new Request(`http://localhost/api/users/${uid}/email${query}`);
    return GET(req as NextRequest, { params: Promise.resolve({ uid }) });
  }

  beforeEach(() => {
    (assertAuthenticated as jest.Mock).mockResolvedValue({
      ok: true,
      user: { id: 'admin-a', email: 'a@example.com', superadmin: false },
    });
    (assertLeagueAdminForUser as jest.Mock).mockImplementation(async (_u, leagueId: string) =>
      leagueId === 'league-a'
        ? { ok: true, user: {} }
        : { ok: false, response: new Response(null, { status: 403 }) }
    );
  });

  it('does not let an admin of league A read emails of users outside league A', async () => {
    (readMembershipsForUid as jest.Mock).mockResolvedValue([{ teamId: 't9', leagueId: 'league-z' }]);
    const res = await getEmail('random-user', '?leagueId=league-a');
    expect(res.status).toBe(403);
  });

  it('lets an admin of league A read emails of players in league A', async () => {
    (readMembershipsForUid as jest.Mock).mockResolvedValue([{ teamId: 't1', leagueId: 'league-a' }]);
    const res = await getEmail('league-a-player', '?leagueId=league-a');
    expect(res.status).toBe(200);
    expect((await res.json()).email).toBe('league-a-player@victim.test');
  });

  it('rejects players and admins of other leagues', async () => {
    (readMembershipsForUid as jest.Mock).mockResolvedValue([{ teamId: 't1', leagueId: 'league-b' }]);
    expect((await getEmail('someone', '?leagueId=league-b')).status).toBe(403);
    expect((await getEmail('someone')).status).toBe(403);
  });

  it('lets a superadmin read any email', async () => {
    (assertAuthenticated as jest.Mock).mockResolvedValue({ ok: true, user: superadmin });
    const res = await getEmail('anyone');
    expect(res.status).toBe(200);
  });
});
