/**
 * @jest-environment node
 */
jest.mock('@/lib/firebaseAdmin', () => ({
  adminAuth: {
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    setCustomUserClaims: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  },
}));

jest.mock('@/lib/db/resolveLeague', () => ({
  resolveLeagueByRef: jest.fn(async () => ({ id: 'uuid-b', slug: 'league-b' })),
}));

jest.mock('@/lib/authGuards', () => ({
  assertSuperAdmin: jest.fn(),
  isAuthFailure: (r: { ok: boolean }) => !r.ok,
}));

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('@/lib/adminUserLookup', () => ({ getAdminDisplayName: jest.fn(async () => null) }));
jest.mock('@/lib/adminIndex', () => ({
  addLeagueToAdmin: jest.fn(),
  removeLeagueFromAdmin: jest.fn(),
  migrateAdminLeaguesToSet: jest.fn(),
}));
jest.mock('@/lib/leagueDoc', () => ({
  readLeagueDocJSON: jest.fn(async () => ({ adminUserId: 'old-admin' })),
  writeLeagueAdminJSON: jest.fn(async () => ({})),
}));
jest.mock('@/lib/repositories/leaguesRepo', () => ({
  listLeagueAdminUserIds: jest.fn(async () => ['old-admin', 'co-admin', 'boss']),
}));

import { adminAuth } from '@/lib/firebaseAdmin';
import { assertSuperAdmin } from '@/lib/authGuards';
import { revokeLeagueAdminAccess, setClaimsAndRevokeSessions } from '../roleRevocation';

const auth = adminAuth as unknown as Record<string, jest.Mock>;
const boss = { id: 'boss', email: 'boss@example.com', superadmin: true };

beforeEach(() => {
  jest.clearAllMocks();
  auth.getUser.mockImplementation(async (uid: string) => ({
    uid,
    emailVerified: true,
    customClaims: { leagueAdminOf: ['league-b', 'uuid-b', 'league-c'] },
  }));
  (assertSuperAdmin as jest.Mock).mockResolvedValue({ ok: true, user: boss });
});

describe('setClaimsAndRevokeSessions', () => {
  it('sets claims and then revokes sessions', async () => {
    await setClaimsAndRevokeSessions('u1', { superadmin: false });
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { superadmin: false });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('u1');
  });
});

describe('revokeLeagueAdminAccess', () => {
  it('strips the league by slug and uuid, keeps other leagues, and revokes sessions', async () => {
    await revokeLeagueAdminAccess('u1', 'league-b');
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { leagueAdminOf: ['league-c'] });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('u1');
  });

  it('skips revocation when keepSessions is set', async () => {
    await revokeLeagueAdminAccess('u1', 'league-b', { keepSessions: true });
    expect(auth.setCustomUserClaims).toHaveBeenCalled();
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('ignores users that no longer exist in Firebase', async () => {
    auth.getUser.mockRejectedValue(Object.assign(new Error('nope'), { code: 'auth/user-not-found' }));
    await expect(revokeLeagueAdminAccess('gone', 'league-b')).resolves.toBeUndefined();
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });
});

describe('POST /api/superadmin/claims', () => {
  it('revokes the target user sessions after changing claims', async () => {
    auth.getUser.mockResolvedValue({ uid: 'u1', customClaims: { superadmin: true } });
    const { POST } = await import('@/app/api/superadmin/claims/route');
    const res = await POST(
      new Request('http://localhost/api/superadmin/claims', {
        method: 'POST',
        body: JSON.stringify({ uidOrEmail: 'u1', patch: { superadmin: false } }),
      })
    );

    expect(res.status).toBe(200);
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { superadmin: false });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('u1');
  });

  it('refuses to grant a role to an unverified email', async () => {
    auth.getUser.mockResolvedValue({ uid: 'u1', emailVerified: false, customClaims: {} });
    const { POST } = await import('@/app/api/superadmin/claims/route');
    const res = await POST(
      new Request('http://localhost/api/superadmin/claims', {
        method: 'POST',
        body: JSON.stringify({ uidOrEmail: 'u1', patch: { leagueAdminOf: ['league-b'] } }),
      })
    );

    expect(res.status).toBe(400);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it('still lets a role be removed from an unverified account', async () => {
    auth.getUser.mockResolvedValue({ uid: 'u1', emailVerified: false, customClaims: { superadmin: true } });
    const { POST } = await import('@/app/api/superadmin/claims/route');
    const res = await POST(
      new Request('http://localhost/api/superadmin/claims', {
        method: 'POST',
        body: JSON.stringify({ uidOrEmail: 'u1', patch: { superadmin: false } }),
      })
    );

    expect(res.status).toBe(200);
  });

  it('does nothing for non-superadmins', async () => {
    (assertSuperAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Forbidden' }, { status: 403 }),
    });
    const { POST } = await import('@/app/api/superadmin/claims/route');
    const res = await POST(
      new Request('http://localhost/api/superadmin/claims', {
        method: 'POST',
        body: JSON.stringify({ uidOrEmail: 'me', patch: { superadmin: true } }),
      })
    );

    expect(res.status).toBe(403);
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});

describe('POST /api/superadmin/leagues/[leagueId]/assign-admin', () => {
  it('revokes every replaced admin except the new one, keeping the caller signed in', async () => {
    const { POST } = await import('@/app/api/superadmin/leagues/[leagueId]/assign-admin/route');
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ adminUserId: 'co-admin' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ leagueId: 'league-b' }) });

    expect(res.status).toBe(200);
    expect(auth.revokeRefreshTokens).toHaveBeenCalledTimes(1);
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('old-admin');
    // caller's league claim is still stripped, just without ending their session
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('boss', expect.anything());
    expect(auth.setCustomUserClaims).not.toHaveBeenCalledWith('co-admin', expect.anything());
  });

  it('refuses to assign an admin whose email is unverified, changing nothing', async () => {
    auth.getUser.mockResolvedValue({ uid: 'squatter', emailVerified: false, customClaims: {} });
    const { writeLeagueAdminJSON } = jest.requireMock('@/lib/leagueDoc') as {
      writeLeagueAdminJSON: jest.Mock;
    };
    const { POST } = await import('@/app/api/superadmin/leagues/[leagueId]/assign-admin/route');
    const req = new Request('http://localhost/x', {
      method: 'POST',
      body: JSON.stringify({ adminUserId: 'squatter' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ leagueId: 'league-b' }) });

    expect(res.status).toBe(400);
    expect(writeLeagueAdminJSON).not.toHaveBeenCalled();
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
  });
});
