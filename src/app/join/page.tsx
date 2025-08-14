// Join via token (?t=...) UI

'use client';
import { useEffect, useState } from 'react';

export default function JoinByToken() {
  const [msg, setMsg] = useState('Joining…');

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('t');
    if (!t) { setMsg('Missing token'); return; }
    fetch('/api/join/by-token', { method: 'POST', body: JSON.stringify({ token: t }) })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) location.href = '/'; else setMsg(j.error || 'Failed to join'); })
      .catch(() => setMsg('Error'));
  }, []);

  return <main><h1>{msg}</h1></main>;
}
