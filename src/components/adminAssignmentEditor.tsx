'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminAssignmentEditorProps {
  leagueId: string;
  leagueAdminName: string | null;
}

export default function AdminAssignmentEditor({
  leagueId,
  leagueAdminName,
}: AdminAssignmentEditorProps) {
  const router = useRouter(); // <-- hooks go inside the component

  const [isEditing, setIsEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/superadmin/leagues/${leagueId}/assign-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        setMessage('Admin assigned successfully!');
        setIsEditing(false);
        setEmail('');
        router.refresh(); // force the server component to re-fetch KV
      } else {
        setMessage(result.error || 'Failed to assign admin');
      }
    } catch {
      setMessage('Failed to assign admin. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEmail('');
    setMessage(null);
  };

  if (isEditing) {
    return (
      <div className="mt-4">
        <div className="card" style={{ paddingLeft: 24, paddingRight: 24, paddingTop: 10, paddingBottom: 24, maxWidth: 500 }}>
          <h3 className="content-title" style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
            Assign New Admin
          </h3>

          <form onSubmit={handleSubmit}>
            <div className="auth-row" style={{ marginBottom: 20 }}>
              <label htmlFor="admin-email" className="auth-label">Admin Email:</label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="auth-input"
                required
                disabled={loading}
              />
            </div>

            {message && (
              <div
                className={`p-3 rounded-lg text-sm mb-4 ${
                  message.includes('successfully') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="btn btn--primary btn--sm"
                style={{ minWidth: 120 }}
              >
                {loading ? 'Assigning...' : 'Assign Admin'}
              </button>
              <button type="button" onClick={handleCancel} disabled={loading} className="btn btn--sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
        League Admin: {leagueAdminName ?? 'no admin assigned to this league yet'}
      </p>
      <button
        type="button"
        className="btn btn--sm"
        style={{ padding: '6px 8px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => setIsEditing(true)}
        title="Edit admin assignment"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
        </svg>
      </button>
    </div>
  );
}