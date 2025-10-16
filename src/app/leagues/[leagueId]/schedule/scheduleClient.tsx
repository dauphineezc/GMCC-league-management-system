// src/app/(admin)/admin/leagues/[leagueId]/schedule/ScheduleClient.tsx
'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import cpf from "dayjs/plugin/customParseFormat";


dayjs.extend(utc); dayjs.extend(tz); dayjs.extend(cpf);

type Params = { leagueId: string };

type Game = {
  id: string;
  leagueId: string;
  dateTimeISO: string;
  location: string;
  homeTeamName: string;
  awayTeamName: string;
  status: 'scheduled' | 'final' | 'canceled' | string;
  homeScore?: number;
  awayScore?: number;
};

type EditingGame = {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  date: string;
  time: string;
  location: string;
  customLocation: string;
};


export default function ScheduleClient({
  leagueId,
  leagueName,                // <- passed in from server
}: {
  leagueId: string;
  leagueName: string;
}) {

  // ---------- state
  const [games, setGames] = useState<Game[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [form, setForm] = useState({
    homeTeamName: "",
    awayTeamName: "",
    date: "",
    time: "",
    location: "Court A",
    customLocation: "",
    timezone: "America/Detroit",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [editingGame, setEditingGame] = useState<EditingGame | null>(null);
  const [saving, setSaving] = useState(false);

  // ---------- helpers
  const canSubmit = useMemo(() => {
    const { homeTeamName, awayTeamName, date, time, location, customLocation } = form;
    const finalLocation = location === "custom" ? customLocation.trim() : location;
    return (
      !!homeTeamName.trim() &&
      !!awayTeamName.trim() &&
      homeTeamName.trim() !== awayTeamName.trim() &&
      !!date &&
      !!time &&
      !!finalLocation
    );
  }, [form]);

  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee" };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #f3f4f6" };

  const sortByTimeAsc = <T extends { dateTimeISO?: string; date?: string }>(list: T[]) =>
    [...list].sort((a, b) => String((a as any).dateTimeISO ?? (a as any).date)
      .localeCompare(String((b as any).dateTimeISO ?? (b as any).date)));

  const toDisplay = (g: any) => {
    const iso = g.dateTimeISO || g.date || g.startTimeISO || g.start || null;
    const dateText = iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
    const timeText = iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
    const court = g.location || g.court || g.venue || "—";
    const home = g.homeTeamName || g.homeName || g.home || g.homeTeamId || "";
    const away = g.awayTeamName || g.awayName || g.away || g.awayTeamId || "";
    const raw = (g.status || "scheduled").toString().toLowerCase();
    const status =
      /final|completed/.test(raw) && g.homeScore != null && g.awayScore != null
        ? `final: ${g.homeScore}-${g.awayScore}`
        : raw.toLowerCase();
    return { dateText, timeText, court, home, away, status };
  };

  const [pdfInfo, setPdfInfo] = useState<{ filename: string; size?: number } | null>(null);

  async function loadPdfInfo() {
    const tryOnce = async () => {
      const r = await fetch(`/api/leagues/${leagueId}/schedule/pdf-info?ts=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return null;
      return r.json();
    };
    const first = await tryOnce();
    if (first) { setPdfInfo(first); return; }
    // one gentle retry to ride out replication
    const second = await new Promise<null | any>(resolve => setTimeout(async () => resolve(await tryOnce()), 400));
    setPdfInfo(second || null);
  }  

  useEffect(() => { loadPdfInfo(); }, [leagueId]);

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);        // <-- important
    await fetch(`/api/leagues/${leagueId}/schedule/upload?ts=${Date.now()}`, {
      method: "POST",
      body: fd,
      cache: "no-store",
    });
    await loadPdfInfo();
    e.target.value = "";
  }  
  
  async function removePdf() {
    const ok = confirm("Remove the uploaded PDF?");
    if (!ok) return;
    
    try {
      const response = await fetch(`/api/leagues/${leagueId}/schedule/pdf?ts=${Date.now()}`, { 
        method: "DELETE",
        cache: 'no-store'
      });
      
      if (response.ok) {
        setPdfInfo(null);
        setMsg("PDF removed successfully!");
      } else {
        const error = await response.json().catch(() => ({ error: 'Remove failed' }));
        setMsg(`Remove failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Remove error:', error);
      setMsg("Remove failed. Please try again.");
    }
  }

  // ---------- data fetch
  async function refresh() {
    try {
      const url = `/api/leagues/${leagueId}/schedule?ts=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setGames(sortByTimeAsc(Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Error fetching games:', err);
    }
  }

  useEffect(() => { if (leagueId) refresh(); }, [leagueId]);

  useEffect(() => {
    if (!leagueId) return;
    fetch(`/api/team-names?leagueId=${encodeURIComponent(leagueId)}`)
      .then(r => (r.ok ? r.json() : []))
      .then(arr => setNames(Array.isArray(arr) ? arr : []))
      .catch(() => setNames([]));
  }, [leagueId]);

  // ---------- actions
  async function addGame(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true); setMsg(null);
    try {
      const finalLocation = form.location === "custom" ? form.customLocation.trim() : form.location;
      const payload = {
        homeTeamName: form.homeTeamName.trim(),
        awayTeamName: form.awayTeamName.trim(),
        location: finalLocation,
        date: form.date,   // yyyy-mm-dd
        time: form.time,   // HH:mm
        timezone: form.timezone,
      };

      const res = await fetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}

      if (res.ok) {
        setMsg("Game added.");
        setForm(prev => ({ ...prev, homeTeamName: "", awayTeamName: "", date: "", time: "", customLocation: "" }));
        setTimeout(refresh, 250);
      } else {
        setMsg(`Error ${res.status}: ${json?.error ?? text ?? res.statusText}`);
      }
    } catch (err) {
      setMsg("Failed to add game.");
    } finally {
      setBusy(false);
    }
  }

  async function delGame(id: string) {
    if (!confirm("Delete this game?")) return;
    setGames(prev => prev.filter(g => g.id !== id)); // optimistic
    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) refresh();
    } catch { refresh(); }
  }

  function startEditing(game: Game) {
    const gameDate = new Date(game.dateTimeISO);
    const dateStr = gameDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = gameDate.toTimeString().slice(0, 5); // HH:MM
    
    setEditingGame({
      id: game.id,
      homeTeamName: game.homeTeamName,
      awayTeamName: game.awayTeamName,
      date: dateStr,
      time: timeStr,
      location: game.location === "Court A" || game.location === "Court B" ? game.location : "custom",
      customLocation: game.location !== "Court A" && game.location !== "Court B" ? game.location : ""
    });
    setMsg(null);
  }

  function cancelEditing() {
    setEditingGame(null);
    setMsg(null);
  }

  async function saveGame() {
    if (!editingGame) return;

    const { homeTeamName, awayTeamName, date, time, location, customLocation } = editingGame;
    const finalLocation = location === "custom" ? customLocation.trim() : location;

    if (!homeTeamName.trim() || !awayTeamName.trim() || homeTeamName.trim() === awayTeamName.trim() || !date || !time || !finalLocation) {
      setMsg("Please fill in all required fields with valid values.");
      return;
    }

    setSaving(true);
    setMsg(null);

    try {
      const payload = {
        homeTeamName: homeTeamName.trim(),
        awayTeamName: awayTeamName.trim(),
        location: finalLocation,
        date: date,
        time: time,
        timezone: form.timezone,
      };


      const res = await fetch(`/api/leagues/${leagueId}/schedule/${encodeURIComponent(editingGame.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}

      console.log('Response status:', res.status);
      console.log('Response text:', text);

      if (res.ok) {
        setMsg("Game updated successfully.");
        setEditingGame(null);
        setTimeout(refresh, 250);
      } else {
        setMsg(`Error ${res.status}: ${json?.error ?? text ?? res.statusText}`);
      }
    } catch (err) {
      console.error('Save error:', err);
      setMsg("Failed to update game.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- UI
  return (
    <main style={{ display: "grid", gap: 16, maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">Schedule Management: {leagueName}</h1>
        </div>
      </header>

      {/* Compact PDF uploader strip */}
      <h3 className="section-header">Schedule File</h3>
      <section className="card--soft rounded-xl border uploader-strip">
        <div className="uploader-row">
          {/* Hidden input + styled label button */}
          <input
            id="pdf-file"
            name="pdf"
            type="file"
            accept="application/pdf"
            onChange={handlePdfChange}
            style={{ display: "none" }}
          />
          <label htmlFor="pdf-file" className="btn btn--light btn-file">
            Upload PDF
          </label>

          <div className="uploader-status">
            {pdfInfo ? <>Current file: <strong>{pdfInfo.filename}</strong> 
            <button 
              type="button" 
              className="link-danger" 
              onClick={removePdf}>Remove
              </button>
              </>
              : <span className="muted">No file uploaded.</span>}
          </div>
        </div>
      </section>


      {/* Manual entry */}
      <h3 className="section-header">Add New Game</h3>

      <form onSubmit={addGame}>

        <section className="form-card">
          <div className="form-card__bar" />
          <div className="form-card__inner">
            {/* Teams row with VS pill */}
            <div className="versus-row">
              <div className="field">
                <label className="field-label">Home Team</label>
                <input
                  list="team-suggestions"
                  className="input input-bordered control"
                  placeholder="e.g. Spurs"
                  value={form.homeTeamName}
                  onChange={(e) => setForm((f) => ({ ...f, homeTeamName: e.target.value }))}
                  disabled={busy}
                />
              </div>

              <span className="vs-pill">VS</span>

              <div className="field">
                <label className="field-label">Away Team</label>
                <input
                  list="team-suggestions"
                  className="input input-bordered control"
                  placeholder="e.g. Sharks"
                  value={form.awayTeamName}
                  onChange={(e) => setForm((f) => ({ ...f, awayTeamName: e.target.value }))}
                  disabled={busy}
                />
              </div>
            </div>

            <datalist id="team-suggestions">
              {names.map((n) => (<option key={n} value={n} />))}
            </datalist>

            <datalist id="team-suggestions-edit">
              {names.map((n) => (<option key={n} value={n} />))}
            </datalist>

            {/* Date / Time / Location */}
            <div className="form-grid thirds">
              <div className="field">
                <label className="field-label">Date</label>
                <input
                  type="date"
                  className="input input-bordered control"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="field-label">Time</label>
                <input
                  type="time"
                  className="input input-bordered control"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="field-label">Location</label>
                <select
                  className="input input-bordered control"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  disabled={busy}
                >
                  <option value="Court A">Court A</option>
                  <option value="Court B">Court B</option>
                  <option value="custom">Add new location…</option>
                </select>
                {form.location === "custom" && (
                  <input
                    className="input input-bordered control mt-2"
                    placeholder="Custom location"
                    value={form.customLocation}
                    onChange={(e) => setForm((f) => ({ ...f, customLocation: e.target.value }))}
                    disabled={busy}
                  />
                )}
              </div>
            </div>

            {/* Actions (Add first for keyboard flow) */}
            <div className="form-actions">
              <button type="submit" className="btn btn--primary" disabled={!canSubmit || busy}>
                {busy ? "Adding…" : "Add Game"}
              </button>
              <div className="actions-left">
                <button type="button" className="btn" onClick={() => setForm((f) => ({ ...f, homeTeamName: f.awayTeamName, awayTeamName: f.homeTeamName }))} disabled={busy}>
                  Swap Teams
                </button>
                <button type="button" className="btn" onClick={() => setForm({ homeTeamName: "", awayTeamName: "", date: "", time: "", location: "Court A", customLocation: "", timezone: "America/New_York" })} disabled={busy}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </section>
      </form>

        {/* Scheduled games */}
        <div className="flex items-center justify-between" style={{ marginTop: 20 }}>
        <h3 className="section-header">Scheduled Games</h3>
          <table className="table-schedule" style={{ width:"100%", borderCollapse:"collapse" }}>
          </table>
        </div>

        {games.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No games yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="schedule-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <colgroup>
                <col style={{ width: "12%" }} />  {/* Date */}
                <col style={{ width: "12%" }} />  {/* Time */}
                <col style={{ width: "18%" }} />  {/* Home */}
                <col style={{ width: "18%" }} />  {/* Away */}
                <col style={{ width: "14%" }} />  {/* Court */}
                <col style={{ width: "18%" }} />  {/* Status */}
                <col style={{ width: "10%" }} />   {/* Actions */}
              </colgroup>

              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Time</th>
                  <th style={th}>Home Team</th>
                  <th style={th}>Away Team</th>
                  <th style={th}>Court</th>
                  <th style={th}>Status</th>
                  <th className="actions" style={th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {games.map(g => {
                  const d = toDisplay(g);
                  const isEditing = editingGame?.id === g.id;
                  
                  return (
                    <tr key={g.id}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editingGame.date}
                            onChange={(e) => setEditingGame(prev => prev ? { ...prev, date: e.target.value } : null)}
                            disabled={saving}
                            style={{ 
                              width: "100%", 
                              padding: "4px 6px", 
                              border: "1px solid #d1d5db", 
                              borderRadius: "4px",
                              fontSize: "14px"
                            }}
                          />
                        ) : (
                          d.dateText
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {isEditing ? (
                          <input
                            type="time"
                            value={editingGame.time}
                            onChange={(e) => setEditingGame(prev => prev ? { ...prev, time: e.target.value } : null)}
                            disabled={saving}
                            style={{ 
                              width: "100%", 
                              padding: "4px 6px", 
                              border: "1px solid #d1d5db", 
                              borderRadius: "4px",
                              fontSize: "14px"
                            }}
                          />
                        ) : (
                          d.timeText
                        )}
                      </td>
                      <td style={td}>
                        {isEditing ? (
                          <input
                            list="team-suggestions-edit"
                            placeholder="Home team"
                            value={editingGame.homeTeamName}
                            onChange={(e) => setEditingGame(prev => prev ? { ...prev, homeTeamName: e.target.value } : null)}
                            disabled={saving}
                            style={{ 
                              width: "100%", 
                              padding: "4px 6px", 
                              border: "1px solid #d1d5db", 
                              borderRadius: "4px",
                              fontSize: "14px"
                            }}
                          />
                        ) : (
                          d.home
                        )}
                      </td>
                      <td style={td}>
                        {isEditing ? (
                          <input
                            list="team-suggestions-edit"
                            placeholder="Away team"
                            value={editingGame.awayTeamName}
                            onChange={(e) => setEditingGame(prev => prev ? { ...prev, awayTeamName: e.target.value } : null)}
                            disabled={saving}
                            style={{ 
                              width: "100%", 
                              padding: "4px 6px", 
                              border: "1px solid #d1d5db", 
                              borderRadius: "4px",
                              fontSize: "14px"
                            }}
                          />
                        ) : (
                          d.away
                        )}
                      </td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>
                        {isEditing ? (
                          <div>
                            <select
                              value={editingGame.location}
                              onChange={(e) => setEditingGame(prev => prev ? { ...prev, location: e.target.value } : null)}
                              disabled={saving}
                              style={{ 
                                width: "100%", 
                                padding: "4px 6px", 
                                border: "1px solid #d1d5db", 
                                borderRadius: "4px",
                                fontSize: "14px",
                                marginBottom: editingGame.location === "custom" ? "4px" : "0"
                              }}
                            >
                              <option value="Court A">Court A</option>
                              <option value="Court B">Court B</option>
                              <option value="custom">Custom</option>
                            </select>
                            {editingGame.location === "custom" && (
                              <input
                                placeholder="Custom location"
                                value={editingGame.customLocation}
                                onChange={(e) => setEditingGame(prev => prev ? { ...prev, customLocation: e.target.value } : null)}
                                disabled={saving}
                                style={{ 
                                  width: "100%", 
                                  padding: "4px 6px", 
                                  border: "1px solid #d1d5db", 
                                  borderRadius: "4px",
                                  fontSize: "14px"
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          d.court
                        )}
                      </td>
                      <td style={td}>{d.status}</td>
                      <td className="actions" style={td}>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={saveGame}
                              disabled={saving}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              onClick={() => startEditing(g)}
                              aria-label={`Edit ${d.home} vs ${d.away}`}
                              title="Edit game"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              onClick={() => delGame(g.id)}
                              aria-label={`Delete ${d.home} vs ${d.away}`}
                              title="Delete game"
                            >
                              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M3 6h18" strokeWidth="2" strokeLinecap="round" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" />
                                <rect x="6" y="6" width="12" height="14" rx="2" strokeWidth="2" />
                                <path d="M10 11v6M14 11v6" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button
          className="link-danger"
          onClick={async () => {
            if (!confirm("Clear all games? This cannot be undone!")) return;
            try {
              const res = await fetch(`/api/debug/clear-games?leagueId=${leagueId}`, { method: "POST" });
              const result = await res.json();
              if (res.ok) {
                setGames([]);
                setMsg("All games cleared.");
              } else {
                setMsg(`Clear failed: ${result.error}`);
              }
            } catch {
              setMsg("Failed to clear games.");
            }
          }}
        >
          Clear All Games
        </button>
    </main>
  );
}