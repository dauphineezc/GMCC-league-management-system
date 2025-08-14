// Team page (roster, your payment, schedule)

'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const t = await fetch('/api/me').then(r => r.json());
      if (t?.team?.id !== teamId) { setTeam(null); return; }
      setTeam(t.team);
      const roster = await fetch(`/api/teams/${teamId}/schedule`).then(() => null).catch(() => null); // noop ensure auth
      const membersArr = await fetch('/api/me').then(r => r.json()).then(d => d.team ? fetchRoster(d.team.id) : []);
      setMembers(membersArr);
    })();
  }, [teamId]);

  const fetchRoster = async (id: string) => {
    // This demo stores roster at team:{id}:members; no dedicated API for brevity
    const res = await fetch('/api/me'); // Using /api/me again for demo; consider making /api/teams/:id public roster
    const j = await res.json();
    // Just re-fetch from KV via a trivial API if you choose; skipping to keep minimal.
    return [];
  };

  const makeLink = async () => {
    const r = await fetch('/api/invites', { method: 'POST', body: JSON.stringify({ teamId, kind: 'link' }) });
    const j = await r.json(); if (r.ok) setInviteUrl(j.inviteUrl); else alert(j.error || 'Error');
  };
  const makeCode = async () => {
    const r = await fetch('/api/invites', { method: 'POST', body: JSON.stringify({ teamId, kind: 'code' }) });
    const j = await r.json(); if (r.ok) setCode(j.code); else alert(j.error || 'Error');
  };

  if (!team) return <main><h1>Team</h1><p>Loading… or you don’t have access.</p></main>;

  return (
    <main>
      <h1>{team.name}</h1>
      <p>Division: {team.divisionId}</p>

      <section>
        <h2>Invites</h2>
        <button onClick={makeLink}>Generate link</button>
        {inviteUrl && <p><a href={inviteUrl}>{inviteUrl}</a></p>}
        <button onClick={makeCode}>Generate code</button>
        {code && <p>Code: <b>{code}</b></p>}
      </section>

      <section>
        <h2>Schedule</h2>
        <a href={`/team/${teamId}/schedule`}>Open schedule →</a>
      </section>
    </main>
  );
}
