// Join page - handles both token (link) and code entry

'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function JoinPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('t');

  const [mode, setMode] = useState<'token' | 'code'>(token ? 'token' : 'code');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Auto-join if token is present
  useEffect(() => {
    if (token && mode === 'token') {
      handleTokenJoin(token);
    }
  }, [token, mode]);

  const handleTokenJoin = async (t: string) => {
    setLoading(true);
    setMessage('Joining team...');
    setError('');

    try {
      const response = await fetch('/api/join/by-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });

      const data = await response.json();

      if (response.ok && data.teamId) {
        setMessage('✅ Successfully joined team! Redirecting...');
        setTimeout(() => {
          router.push(`/team/${data.teamId}`);
        }, 1000);
      } else {
        const errorMsg = data.error?.code === 'UNAUTHENTICATED' 
          ? 'Please sign in first to join this team.'
          : data.error?.code === 'ALREADY_ON_TEAM'
          ? 'You are already on a team in this league.'
          : data.error?.code === 'TEAM_FULL'
          ? 'This team is full.'
          : data.error?.code === 'INVITE_INVALID'
          ? 'This invite link is invalid or has expired.'
          : 'Failed to join team.';
        
        setError(errorMsg);
        setMessage('');
      }
    } catch (err) {
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
      return;
    }

    setLoading(true);
    setMessage('Joining team...');
    setError('');

    try {
      const response = await fetch('/api/join/by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.ok && data.team) {
        setMessage('✅ Successfully joined team! Redirecting...');
        setTimeout(() => {
          router.push(`/team/${data.team.id}`);
        }, 1000);
      } else {
        const errorMsg = data.error === 'Already on a team'
          ? 'You are already on a team in this league.'
          : data.error === 'Invalid/expired code'
          ? 'This code is invalid or has expired.'
          : typeof data.error === 'string'
          ? data.error
          : 'Failed to join team.';
        
        setError(errorMsg);
        setMessage('');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 20, maxWidth: 500, margin: '0 auto' }}>
      <h1 className="page-title">Join a Team</h1>
      
      {mode === 'token' ? (
        <div className="card" style={{ padding: 20 }}>
          {loading && <p>{message}</p>}
          {error && (
            <div style={{ 
              background: '#ffebee', 
              color: '#c62828', 
              padding: 16, 
              borderRadius: 4,
              marginBottom: 16 
            }}>
              {error}
            </div>
          )}
          {!loading && !error && !message && (
            <p>Processing invite link...</p>
          )}
          {!loading && error && (
            <button 
              className="btn btn--outline"
              onClick={() => router.push('/')}
              style={{ marginTop: 12 }}
            >
              Go Home
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

            {error && (
              <div style={{ 
                background: '#ffebee', 
                color: '#c62828', 
                padding: 12, 
                borderRadius: 4,
                marginBottom: 16 
              }}>
                {error}
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
