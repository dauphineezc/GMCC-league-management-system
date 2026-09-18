/**
 * @jest-environment node
 */
import { POST } from '../join/by-token/route';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/authGuards', () => ({
  assertAuthenticated: jest.fn(),
  isAuthFailure: (r: { ok: boolean }) => !r.ok,
}));

jest.mock('@/server/invites', () => ({
  peekLinkInvite: jest.fn(),
}));

jest.mock('@/server/acceptInvite', () => ({
  acceptInviteForUser: jest.fn(),
}));

import { assertAuthenticated } from '@/lib/authGuards';
import { peekLinkInvite } from '@/server/invites';
import { acceptInviteForUser } from '@/server/acceptInvite';

const mockUser = {
  id: 'user123',
  email: 'player@example.com',
  superadmin: false,
};

function tokenRequest(token: string) {
  return new Request('http://localhost/api/join/by-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }) as unknown as NextRequest;
}

describe('/api/join/by-token POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (assertAuthenticated as jest.Mock).mockResolvedValue({ ok: true, user: mockUser });
    (peekLinkInvite as jest.Mock).mockResolvedValue({ id: 'inv-1', teamId: 'team-1' });
    (acceptInviteForUser as jest.Mock).mockResolvedValue({
      teamId: 'team-1',
      team: { id: 'team-1', name: 'Hawks' },
    });
  });

  it('returns 401 with UNAUTHENTICATED and does not peek the invite', async () => {
    (assertAuthenticated as jest.Mock).mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(tokenRequest('abc'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(peekLinkInvite).not.toHaveBeenCalled();
    expect(acceptInviteForUser).not.toHaveBeenCalled();
  });

  it('joins the signed-in user and returns teamId', async () => {
    const res = await POST(tokenRequest('abc'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, teamId: 'team-1' });
    expect(peekLinkInvite).toHaveBeenCalledWith('abc');
    expect(acceptInviteForUser).toHaveBeenCalledWith('user123', { id: 'inv-1', teamId: 'team-1' });
  });

  it('does not accept the invite when peek says it is invalid', async () => {
    (peekLinkInvite as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Invalid/expired invite'), { status: 400, code: 'INVITE_INVALID' })
    );

    const res = await POST(tokenRequest('bad'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('INVITE_INVALID');
    expect(acceptInviteForUser).not.toHaveBeenCalled();
  });
});
