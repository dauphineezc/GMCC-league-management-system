// Dashboard: calls /api/me; routes user to team/CTA

'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState('');
  const [divisionId, setDivisionId] = useState('4v4');

  useEffect(() => { fetch('/api/me').then(r => r.json()).then(setData); }, []);

  if (!data) return <p>Loading…</p>;

  const createTeam = async () => {
    const r = await fetch('/api/teams', { method: 'POST', body: JSON.stringify({ name, divisionId }) });
    const j = await r.json();
    if (r.ok) location.reload(); else alert(j.error || 'Error');
  };

  const payNow = async () => {
    const r = await fetch('/api/payments/create', { method: 'POST', body: JSON.stringify({ teamId: data.team.id }) });
    const j = await r.json();
    if (r.ok) location.href = j.redirectUrl; else alert(j.error || 'Error');
  };

  return (
    <main>
      <h1>League MVP</h1>
      {!data.membership && (
        <>
          <h2>Create a team</h2>
          <input placeholder="Team name" value={name} onChange={e => setName(e.target.value)} />
          <select value={divisionId} onChange={e => setDivisionId(e.target.value)}>
            <option value="4v4-lowb">4v4 Low B</option>
            <option value="4v4">4v4</option>
            <option value="4v4-highba">4v4 High B/A</option>
            <option value="4v4-women">4v4 Women</option>
            <option value="5v5">5v5</option>
          </select>
          <button onClick={createTeam}>Create</button>

          <h2>Join with code</h2>
          <JoinWithCode />
        </>
      )}

      {data.membership && data.team && (
        <>
          <h2>Your team</h2>
          <p>{data.team.name} — {data.team.divisionId} — Role: {data.team.role}</p>
          <a href={`/team/${data.team.id}`}>Open team page →</a>

          <h3>Your payment</h3>
          {data.payment ? (
            <>
              <p>Status: {data.payment.status} | Due: {data.payment.dueBy}</p>
              {data.payment.status !== 'PAID' && <button onClick={payNow}>Pay now</button>}
            </>
          ) : <p>No payment record.</p>}

          <h3>Next games</h3>
          <ul>{data.nextGames.map((g: any) => <li key={g.id}>{g.startAt} @ {g.location}</li>)}</ul>
        </>
      )}
    </main>
  );
}

function JoinWithCode() {
  const [code, setCode] = useState('');
  const join = async () => {
    const r = await fetch('/api/join/by-code', { method: 'POST', body: JSON.stringify({ code }) });
    const j = await r.json();
    if (r.ok) location.reload(); else alert(j.error || 'Error');
  };
  return (
    <div>
      <input placeholder="Enter code" value={code} onChange={e => setCode(e.target.value)} />
      <button onClick={join}>Join</button>
    </div>
  );
}
