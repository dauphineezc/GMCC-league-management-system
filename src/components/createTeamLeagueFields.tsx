"use client";
import { useMemo, useState } from "react";
export type LeagueOption = {
  id: string;
  name: string;
  sport: string;
  gender: string | null;
  division: string | null;
};
function labelLeague(l: LeagueOption): string {
  const bits = [l.name];
  const meta = [l.gender, l.division].filter(Boolean);
  if (meta.length) bits.push(`(${meta.join(" · ")})`);
  return bits.join(" ");
}
function titleSport(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function CreateTeamLeagueFields({
  leagues,
}: {
  leagues: LeagueOption[];
}) {
  const sports = useMemo(() => {
    const set = new Set(leagues.map((l) => l.sport).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [leagues]);
  const [sport, setSport] = useState(sports[0] ?? "");
  const leaguesForSport = useMemo(
    () => leagues.filter((l) => l.sport === sport),
    [leagues, sport]
  );

  if (leagues.length === 0) {
    return (
      <label>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>League</div>
        <select
          name="leagueId"
          defaultValue=""
          className="input"
          style={{ width: "100%" }}
          required
          disabled
        >
          <option value="" disabled>
            No leagues available
          </option>
        </select>
      </label>
    );
  }

  return (
    <div className="sport-division-cascade" style={{ display: "grid", gap: 14 }}>
      <label>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Sport</div>
        <select
          className="input"
          style={{ width: "100%" }}
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          required
          aria-label="Sport"
        >
          {sports.map((s) => (
            <option key={s} value={s}>
              {titleSport(s)}
            </option>
          ))}
        </select>
      </label>

      <label>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>League</div>
        <select
          name="leagueId"
          key={sport}
          defaultValue=""
          className="input"
          style={{ width: "100%" }}
          required
          disabled={leaguesForSport.length === 0}
        >
          <option value="" disabled>
            {leaguesForSport.length === 0
              ? "No leagues for this sport"
              : "Select a league…"}
          </option>
          {leaguesForSport.map((l) => (
            <option key={l.id} value={l.id}>
              {labelLeague(l)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}