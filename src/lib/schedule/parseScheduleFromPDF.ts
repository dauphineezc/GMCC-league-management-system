// src/lib/schedule/parseScheduleFromPDF.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import { pdfToText } from './pdfParseShim.node'; // the Node-only shim you just added
dayjs.extend(utc); dayjs.extend(tz);

export type ParseOpts = {
  leagueId: string;
  seasonYear: number;
  timezone?: string;
  knownTeams?: string[]; // <- strongly recommended so we can split "SpursSharks" reliably
};

const DATE_RE = /\b(\d{1,2})\/(\d{1,2})\b/;
const TIME_RE = /\b(\d{1,2}):(\d{2})\s?(AM|PM)\b/i;

function norm(s: string) { return s.replace(/\s+/g, '').toLowerCase(); }

/**
 * Try to split a left-side "teams" blob into [home, away].
 * Works when the blob is "HomeTeam AwayTeam" OR "HomeTeamAwayTeam".
 * If knownTeams are provided, we match by concatenation (space-insensitive).
 */
function splitTeamsSmart(teamBlob: string, knownTeams?: string[]) {
  const raw = teamBlob.trim().replace(/\s+/g, ' ');

  // Easy case: there's at least one space AND knownTeams don’t matter
  if (!knownTeams?.length && /\s/.test(raw)) {
    const parts = raw.split(' ');
    const mid = Math.floor(parts.length / 2);
    return [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
  }

  // If we have known teams, try exact pair match by concatenation
  if (knownTeams?.length) {
    const target = norm(raw);
    for (const a of knownTeams) {
      for (const b of knownTeams) {
        if (a === b) continue;
        if (norm(a + b) === target) return [a, b];
      }
    }
  }

  // Fallback: split by midpoint of characters (works for "SpursSharks")
  const chars = raw.split('');
  const mid = Math.floor(chars.length / 2);
  return [chars.slice(0, mid).join('').trim(), chars.slice(mid).join('').trim()];
}

export async function parseScheduleFromPDF(
  fileBuffer: Buffer,
  { leagueId, seasonYear, timezone = 'America/Detroit', knownTeams }: ParseOpts
) {
  if (!fileBuffer?.length) throw new Error('Empty file upload');

  const text = await pdfToText(fileBuffer);

  // Split into lines; many PDFs will have rows with columns stuck together
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Header detection: tolerate collapsed spaces like "Home TeamAway TeamDateTimeLocation"
  const headerKey = 'hometeamawayteamdatetimelocation';
  const headerIdx = lines.findIndex(l => norm(l).includes(headerKey));
  if (headerIdx === -1) {
    throw new Error(
      'Could not find schedule header in PDF. First lines: ' + lines.slice(0, 12).join(' | ')
    );
  }

  const rows = lines.slice(headerIdx + 1).filter(Boolean);

  const games = [];
  for (const row of rows) {
    // Find date/time anywhere in the row; this gives us the split point
    const dateMatch = row.match(DATE_RE);
    const timeMatch = row.match(TIME_RE);
    if (!dateMatch || !timeMatch) continue;

    const idxDate = row.indexOf(dateMatch[0]);
    if (idxDate < 0) continue;

    const leftTeams = row.slice(0, idxDate).trim();  // e.g. "SpursSharks"
    const right = row.slice(idxDate).trim();         // e.g. "8/30 7:00 PMCourt A"

    // Parse date
    const m = parseInt(dateMatch[1], 10);
    const d = parseInt(dateMatch[2], 10);

    // Parse time
    const hh = parseInt(timeMatch[1], 10);
    const min = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3].toUpperCase();
    let hour24 = hh % 12; if (ampm === 'PM') hour24 += 12;

    // Location = everything after the matched time, trimmed;
    // works even when the space is missing before "Court"
    const afterTime = right.slice(right.indexOf(timeMatch[0]) + timeMatch[0].length).trim();
    const location = afterTime;

    const [homeTeamName, awayTeamName] = splitTeamsSmart(leftTeams, knownTeams);

    const local = dayjs.tz(
      `${seasonYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(hour24).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      timezone
    );
    const iso = local.utc().toISOString();

    games.push({
      id: `${leagueId}:${iso}:${homeTeamName}-${awayTeamName}`,
      leagueId,
      dateTimeISO: iso,
      location,
      homeTeamName,
      awayTeamName,
      status: 'scheduled' as const,
    });
  }

  return games;
}