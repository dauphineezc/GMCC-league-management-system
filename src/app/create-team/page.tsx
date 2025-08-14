// Simple form (name + division)

'use client';
import { useState } from 'react';

export default function CreateTeamPage() {
  const [name, setName] = useState('');
  const [divisionId, setDivisionId] = useState('4v4');
  const submit = async () => {
    const r = await fetch('/api/teams', { method: 'POST', body: JSON.stringify({ name, divisionId }) });
    const j = await r.json();
    if (r.ok) location.href = '/'; else alert(j.error || 'Error');
  };
  return (
    <main>
      <h1>Create Team</h1>
      <input placeholder="Team name" value={name} onChange={e => setName(e.target.value)} />
      <select value={divisionId} onChange={e => setDivisionId(e.target.value)}>
        <option value="4v4-lowb">4v4 Low B</option>
        <option value="4v4">4v4</option>
        <option value="4v4-highba">4v4 High B/A</option>
        <option value="4v4-women">4v4 Women</option>
        <option value="5v5">5v5</option>
      </select>
      <button onClick={submit}>Create</button>
    </main>
  );
}
