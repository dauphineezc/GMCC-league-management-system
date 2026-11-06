/**
 * @jest-environment node
 */
jest.mock('@/lib/firebaseAdmin', () => ({
  adminAuth: {
    verifySessionCookie: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  },
}));

const cookieValue = { current: undefined as string | undefined };
jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: () => (cookieValue.current ? { value: cookieValue.current } : undefined),
  })),
}));

import * as logoutRoute from '../auth/logout/route';
import { adminAuth } from '@/lib/firebaseAdmin';

const auth = adminAuth as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  cookieValue.current = undefined;
});

describe('/api/auth/logout', () => {
  it('no longer accepts GET', () => {
    expect((logoutRoute as Record<string, unknown>).GET).toBeUndefined();
  });

  it('revokes the session and clears both cookie variants', async () => {
    cookieValue.current = 'session-cookie';
    auth.verifySessionCookie.mockResolvedValue({ uid: 'u1' });

    const res = await logoutRoute.POST();

    expect(res.status).toBe(200);
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('u1');
    const setCookies = res.headers.getSetCookie();
    expect(setCookies).toHaveLength(2);
    expect(setCookies.every((c) => c.includes('fb:session=;') || c.startsWith('fb:session=;'))).toBe(true);
  });

  it('still clears cookies when the session is already invalid', async () => {
    cookieValue.current = 'expired';
    auth.verifySessionCookie.mockRejectedValue(new Error('expired'));

    const res = await logoutRoute.POST();

    expect(res.status).toBe(200);
    expect(auth.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });
});
