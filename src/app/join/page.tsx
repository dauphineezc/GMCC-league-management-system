// Join page - handles both token (link) and code entry

'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function isUnauthenticatedResponse(response: Response, data: any): boolean {
  if (response.status !== 401) return false;
  if (data?.error?.code === 'UNAUTHENTICATED') return true;
  const msg = typeof data?.error === 'string' ? data.error : data?.error?.message;
  return (
    typeof msg === 'string' &&
    (/unauthorized/i.test(msg) || /sign in/i.test(msg))
  );
}

function AuthRequiredMessage({ loginHref }: { loginHref: string }) {
  return (
    <>
      Unable to join. Please{' '}
      <Link href={loginHref} style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
        sign in or create an account
      </Link>
      .
    </>
  );
}

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('t');
  const codeParam = searchParams?.get('code');

  const [mode] = useState<'token' | 'code'>(token ? 'token' : 'code');
  const [code, setCode] = useState(codeParam?.trim().toUpperCase() ?? '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);

  const joinReturnPath = (() => {
    if (mode === 'token' && token) return `/join?t=${encodeURIComponent(token)}`;
    if (code.trim()) return `/join?code=${encodeURIComponent(code.trim())}`;
    return '/join';
  })();
  const loginHref = `/login?next=${encodeURIComponent(joinReturnPath)}`;

  // Auto-join if token is present
  useEffect(() => {
    if (token && mode === 'token') {
      handleTokenJoin(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mode]);

  const handleTokenJoin = async (t: string) => {
    setLoading(true);
    setMessage('Joining team...');
    setError('');
    setNeedsAuth(false);

    try {
      const response = await fetch('/api/join/by-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: t }),
      });

      const data = await response.json();

      if (response.ok && data.teamId) {
        setMessage('✅ Successfully joined team! Redirecting...');
        setTimeout(() => {
          router.push(`/team/${data.teamId}?joined=true`);
        }, 1000);
      } else if (isUnauthenticatedResponse(response, data)) {
        setNeedsAuth(true);
        setMessage('');
      } else {
        const errorMsg = data.error?.code === 'ALREADY_ON_TEAM'
          ? 'You are already on a team in this league.'
          : data.error?.code === 'TEAM_FULL'
          ? 'This team is full.'
          : data.error?.code === 'INVITE_INVALID'
          ? 'This invite link is invalid or has expired.'
          : data.error?.code === 'DEADLINE_PASSED'
          ? 'The player add deadline for this league has passed. This invite is no longer valid.'
          : 'Failed to join team.';
        
        setError(errorMsg);
        setMessage('');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code.trim()) {
      setError('Please enter a code');
      setNeedsAuth(false);
      return;
    }

    setLoading(true);
    setMessage('Joining team...');
    setError('');
    setNeedsAuth(false);

    try {
      const response = await fetch('/api/join/by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.ok && data.team) {
        setMessage('✅ Successfully joined team! Redirecting...');
        setTimeout(() => {
          router.push(`/team/${data.team.id}?joined=true`);
        }, 1000);
      } else if (isUnauthenticatedResponse(response, data)) {
        setNeedsAuth(true);
        setMessage('');
      } else {
        const errorMsg = data.error === 'Already on a team'
          ? 'You are already on a team in this league.'
          : data.error === 'Invalid/expired code' || data.error === 'Invalid/expired invite'
          ? 'This code is invalid or has expired.'
          : typeof data.error === 'string'
          ? data.error
          : 'Failed to join team.';
        
        setError(errorMsg);
        setMessage('');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  const errorBoxStyle = {
    background: '#ffebee',
    color: '#c62828',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  } as const;

  return (
    <main style={{ padding: 20, maxWidth: 500, margin: '0 auto' }}>
      <h1 className="page-title">Join a Team</h1>
      
      {mode === 'token' ? (
        <div className="card" style={{ padding: 20 }}>
          {loading && <p>{message}</p>}
          {(needsAuth || error) && (
            <div style={{ ...errorBoxStyle, padding: 16 }}>
              {needsAuth ? <AuthRequiredMessage loginHref={loginHref} /> : error}
            </div>
          )}
          {!loading && !error && !needsAuth && !message && (
            <p>Processing invite link...</p>
          )}
          {!loading && (error || needsAuth) && (
            <button 
              className="btn btn--outline"
              onClick={() => router.push(needsAuth ? loginHref : '/')}
              style={{ marginTop: 12 }}
            >
              {needsAuth ? 'Sign In' : 'Go Home'}
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 20 }}>
          <p style={{ marginBottom: 20, color: '#666' }}>
            Enter the invite code provided by your team manager.
          </p>

          <form onSubmit={handleCodeJoin}>
            <div style={{ marginBottom: 16 }}>
              <label 
                htmlFor="code" 
                style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}
              >
                Invite Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter 8-character code"
                maxLength={8}
                className="input"
                style={{
                  width: '100%',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
                disabled={loading}
              />
            </div>

            {(needsAuth || error) && (
              <div style={errorBoxStyle}>
                {needsAuth ? <AuthRequiredMessage loginHref={loginHref} /> : error}
              </div>
            )}

            {message && (
              <div style={{ 
                background: '#e8f5e9', 
                color: '#2e7d32', 
                padding: 12, 
                borderRadius: 4,
                marginBottom: 16 
              }}>
                {message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => router.push('/')}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading || !code.trim()}
              >
                {loading ? 'Joining...' : 'Join Team'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinContent />
    </Suspense>
  );
}
