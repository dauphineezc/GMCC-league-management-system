/**
 * @jest-environment node
 */
import { POST } from '../join/by-code/route';
import type { NextRequest } from 'next/server';

jest.mock('@/lib/authGuards', () => ({
  assertAuthenticated: jest.fn(),
  isAuthFailure: (r: { ok: boolean }) => !r.ok,
}));

jest.mock('@/server/invites', () => ({
  peekCodeInvite: jest.fn(),
}));

jest.mock('@/server/acceptInvite', () => ({
  acceptInviteForUser: jest.fn(),
}));

jest.mock('@/lib/repositories/joinAttemptsRepo', () => ({
  isJoinCodeRateLimited: jest.fn(async () => false),
  recordJoinCodeFailure: jest.fn(),
}));

import {
  isJoinCodeRateLimited,
  recordJoinCodeFailure,
} from '@/lib/repositories/joinAttemptsRepo';
import { assertAuthenticated } from '@/lib/authGuards';
import { peekCodeInvite } from '@/server/invites';
import { acceptInviteForUser } from '@/server/acceptInvite';

const mockUser = {
  id: 'user123',
  email: 'player@example.com',
  superadmin: false,
};

function codeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/join/by-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('/api/join/by-code POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (assertAuthenticated as jest.Mock).mockResolvedValue({ ok: true, user: mockUser });
    (peekCodeInvite as jest.Mock).mockResolvedValue({ id: 'inv-1', teamId: 'team-1' });
    (acceptInviteForUser as jest.Mock).mockResolvedValue({
      teamId: 'team-1',
      team: { id: 'team-1', name: 'Hawks', leagueId: 'league-1' },
    });
  });

  it('returns 401 and does not peek the invite when signed out', async () => {
    (assertAuthenticated as jest.Mock).mockResolvedValue({
      ok: false,
      response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
    });

    const res = await POST(codeRequest({ code: 'ABCD1234' }));

    expect(res.status).toBe(401);
    expect(peekCodeInvite).not.toHaveBeenCalled();
    expect(acceptInviteForUser).not.toHaveBeenCalled();
  });

  it('returns 400 when the code is missing', async () => {
    const res = await POST(codeRequest({}));

    expect(res.status).toBe(400);
    expect(peekCodeInvite).not.toHaveBeenCalled();
  });

  it('joins the signed-in user and returns the team', async () => {
    const res = await POST(codeRequest({ code: 'ABCD1234' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      team: { id: 'team-1', name: 'Hawks', leagueId: 'league-1' },
    });
    expect(acceptInviteForUser).toHaveBeenCalledWith(
      'user123',
      { id: 'inv-1', teamId: 'team-1' },
      { email: 'player@example.com' }
    );
  });

  it('returns 429 without checking the code when rate limited', async () => {
    (isJoinCodeRateLimited as jest.Mock).mockResolvedValueOnce(true);

    const res = await POST(codeRequest({ code: 'ABCD1234' }));

    expect(res.status).toBe(429);
    expect(isJoinCodeRateLimited).toHaveBeenCalledWith('user123', '203.0.113.7');
    expect(peekCodeInvite).not.toHaveBeenCalled();
  });

  it('records a failure only for invalid codes', async () => {
    (peekCodeInvite as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Invalid/expired invite'), { status: 400, code: 'INVITE_INVALID' })
    );
    await POST(codeRequest({ code: 'WRONG123' }));
    expect(recordJoinCodeFailure).toHaveBeenCalledWith('user123', '203.0.113.7');

    (recordJoinCodeFailure as jest.Mock).mockClear();
    (acceptInviteForUser as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Team is full'), { status: 400, code: 'TEAM_FULL' })
    );
    const full = await POST(codeRequest({ code: 'ABCD1234' }));
    expect(full.status).toBe(400);
    expect(recordJoinCodeFailure).not.toHaveBeenCalled();
  });

  it('passes through client errors and hides server error details', async () => {
    (peekCodeInvite as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Invalid/expired invite'), { status: 400 })
    );
    const bad = await POST(codeRequest({ code: 'nope' }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe('Invalid/expired invite');

    (acceptInviteForUser as jest.Mock).mockRejectedValueOnce(new Error('db password leaked'));
    const boom = await POST(codeRequest({ code: 'ABCD1234' }));
    expect(boom.status).toBe(500);
    expect((await boom.json()).error).toBe('Failed to join team.');
  });
});
