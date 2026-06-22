/** @jest-environment node */

jest.mock('@/lib/firebaseAdmin', () => ({
  adminAuth: {
    verifySessionCookie: jest.fn(),
  },
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

jest.mock('@vercel/kv', () => ({
  kv: {
    sismember: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('@/lib/serverUser', () => ({
  getServerUser: jest.fn(),
  isLeagueAdminAsync: jest.fn(),
}));

import { getServerUser, isLeagueAdminAsync } from '@/lib/serverUser';
import {
  assertAuthenticated,
  assertLeagueAdmin,
  assertSuperAdmin,
  isAuthFailure,
} from '../authGuards';

const mockUser = {
  id: 'user123',
  email: 'test@example.com',
  superadmin: false,
  leagueAdminOf: ['league1'],
};

describe('authGuards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assertAuthenticated returns 401 when no session', async () => {
    (getServerUser as jest.Mock).mockResolvedValue(null);

    const result = await assertAuthenticated();
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.response.status).toBe(401);
    }
  });

  it('assertSuperAdmin returns 403 for non-superadmin', async () => {
    (getServerUser as jest.Mock).mockResolvedValue(mockUser);

    const result = await assertSuperAdmin();
    expect(isAuthFailure(result)).toBe(true);
    if (isAuthFailure(result)) {
      expect(result.response.status).toBe(403);
    }
  });

  it('assertLeagueAdmin allows superadmin without KV lookup', async () => {
    (getServerUser as jest.Mock).mockResolvedValue({
      ...mockUser,
      superadmin: true,
    });

    const result = await assertLeagueAdmin('any-league');
    expect(isAuthFailure(result)).toBe(false);
    if (!isAuthFailure(result)) {
      expect(result.user.superadmin).toBe(true);
    }
    expect(isLeagueAdminAsync).not.toHaveBeenCalled();
  });

  it('assertLeagueAdmin allows KV-based league admin', async () => {
    (getServerUser as jest.Mock).mockResolvedValue(mockUser);
    (isLeagueAdminAsync as jest.Mock).mockResolvedValue(true);

    const result = await assertLeagueAdmin('league1');
    expect(isAuthFailure(result)).toBe(false);
    expect(isLeagueAdminAsync).toHaveBeenCalledWith(mockUser, 'league1');
  });
});
