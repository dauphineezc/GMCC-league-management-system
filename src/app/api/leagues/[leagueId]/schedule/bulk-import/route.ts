// src/app/api/leagues/[leagueId]/schedule/bulk-import/route.ts
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { createScheduledGame } from "@/lib/repositories/gamesRepo";
import { getLeagueTeamNames } from "@/lib/repositories/teamsRepo";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import tz from "dayjs/plugin/timezone";
import cpf from "dayjs/plugin/customParseFormat";

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(cpf);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CSVRow {
  homeTeamName: string;
  awayTeamName: string;
  date: string;
  time: string;
  location: string;
}

const DATE_FORMATS = [
  "MM/DD/YYYY",
  "M/D/YYYY",
  "MM-DD-YYYY",
  "M/D/YY",
  "MM/DD/YY",
  "MM-DD-YY",
  "YYYY-MM-DD",
];

const TIME_FORMATS = [
  "HH:mm",
  "H:mm",
  "HH:mm:ss",
  "H:mm:ss",
  "h:mm A",
  "h:mm a",
  "h:mm:ss A",
  "h:mm:ss a",
  // Excel often exports AM/PM with no space: 7:00:00PM
  "h:mmA",
  "h:mma",
  "h:mm:ssA",
  "h:mm:ssa",
];

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      // RFC-style escaped quote: ""
      if (inQuotes && line[j + 1] === '"') {
        currentField += '"';
        j++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(currentField.trim());
      currentField = "";
    } else {
      currentField += char;
    }
  }
  fields.push(currentField.trim());
  return fields;
}

/** True only when the first row looks like a header, not a data row. */
function looksLikeHeader(fields: string[]): boolean {
  const joined = fields.join(" ").toLowerCase();
  // Prefer whole-word matches so team names like "Sometime Team" are not headers.
  return (
    /\b(home|away|date|time|location|team)\b/.test(joined) &&
    !/^\d{1,2}[\/\-]\d{1,2}/.test(fields[2] ?? "") // col 3 looks like a date → data row
  );
}

/** Split a combined datetime cell Excel often produces (e.g. "9/24/2026 7:00:00PM"). */
function splitDateAndTime(value: string): { date: string; time: string } | null {
  const trimmed = value.trim();
  const m = trimmed.match(
    /^(\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4})\s+(.+)$/
  );
  if (!m) return null;
  return { date: m[1].trim(), time: m[2].trim() };
}

function parseCSV(csvText: string): CSVRow[] {
  // Strip UTF-8 BOM if present (common from Excel)
  const text = csvText.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  const rows: CSVRow[] = [];
  const firstFields = splitCsvLine(lines[0].trim());
  const hasHeader = looksLikeHeader(firstFields);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const rowNum = i + (hasHeader ? 2 : 1);
    const fields = splitCsvLine(line);

    let homeTeamName: string;
    let awayTeamName: string;
    let date: string;
    let time: string;
    let location: string;

    if (fields.length >= 5) {
      [homeTeamName, awayTeamName, date, time, location] = fields;
    } else if (fields.length === 4) {
      // Excel often merges date+time into one column:
      // home, away, "9/24/2026 7:00:00PM", location
      const split = splitDateAndTime(fields[2]);
      if (!split) {
        throw new Error(
          `Row ${rowNum} has 4 columns, expected 5 (homeTeam, awayTeam, date, time, location). ` +
            `If date and time are in one column, use e.g. "9/24/2026 7:00 PM". Got: ${fields.map((f) => JSON.stringify(f)).join(", ")}`
        );
      }
      homeTeamName = fields[0];
      awayTeamName = fields[1];
      date = split.date;
      time = split.time;
      location = fields[3];
    } else {
      throw new Error(
        `Row ${rowNum} has ${fields.length} columns, expected 5 (homeTeam, awayTeam, date, time, location). ` +
          `Got: ${fields.map((f) => JSON.stringify(f)).join(", ")}`
      );
    }

    if (!homeTeamName || !awayTeamName || !date || !time || !location) {
      throw new Error(`Row ${rowNum} has empty required fields`);
    }

    rows.push({
      homeTeamName: homeTeamName.trim(),
      awayTeamName: awayTeamName.trim(),
      date: date.trim(),
      time: time.trim(),
      location: location.trim(),
    });
  }

  return rows;
}

function parseRowDateTime(
  row: CSVRow,
  timezone: string
): { startsAt: Date } | { error: string } {
  const parsedDate = dayjs(row.date, DATE_FORMATS, true);

  if (!parsedDate.isValid()) {
    return {
      error: `Invalid date format "${row.date}". Use MM/DD/YYYY, M/D/YY, M-D-YY, YYYY-MM-DD, or MM-DD-YYYY`,
    };
  }

  const parsedTime = dayjs(row.time, TIME_FORMATS, true);

  if (!parsedTime.isValid()) {
    return {
      error: `Invalid time format "${row.time}". Use HH:mm (24-hour) or h:mm AM/PM`,
    };
  }

  const dateTimeStr = `${parsedDate.format("YYYY-MM-DD")}T${parsedTime.format("HH:mm")}`;
  return { startsAt: dayjs.tz(dateTimeStr, timezone).toDate() };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  try {
    const { leagueId } = await params;
    const auth = await assertLeagueAdmin(leagueId);
    if (isAuthFailure(auth)) return auth.response;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const timezone = (form.get("timezone") as string) || "America/Detroit";

    if (!file) {
      return new Response(JSON.stringify({ error: "Missing CSV file" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return new Response(JSON.stringify({ error: "File must be a CSV (.csv)" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const csvText = await file.text();
    let rows: CSVRow[];

    try {
      rows = parseCSV(csvText);
    } catch (parseError: any) {
      return new Response(
        JSON.stringify({ error: `CSV parsing error: ${parseError.message}` }),
        { status: 400, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No valid games found in CSV" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const leagueTeamNames = await getLeagueTeamNames(leagueId);
    const importedIds: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        if (row.homeTeamName === row.awayTeamName) {
          errors.push(`Row ${rowNum}: Home and away teams cannot be the same`);
          continue;
        }

        if (!leagueTeamNames.has(row.homeTeamName)) {
          errors.push(
            `Row ${rowNum}: Home team "${row.homeTeamName}" is not in this league`
          );
          continue;
        }

        if (!leagueTeamNames.has(row.awayTeamName)) {
          errors.push(
            `Row ${rowNum}: Away team "${row.awayTeamName}" is not in this league`
          );
          continue;
        }

        const dt = parseRowDateTime(row, timezone);
        if ("error" in dt) {
          errors.push(`Row ${rowNum}: ${dt.error}`);
          continue;
        }

        const created = await createScheduledGame({
          leagueRef: leagueId,
          homeTeamName: row.homeTeamName,
          awayTeamName: row.awayTeamName,
          location: row.location,
          startsAt: dt.startsAt,
        });

        if (!created) {
          errors.push(`Row ${rowNum}: Failed to create game (league not found?)`);
          continue;
        }

        importedIds.push(created.id);
      } catch (rowError: any) {
        errors.push(`Row ${rowNum}: ${rowError.message}`);
      }
    }

    if (importedIds.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No valid games could be imported",
          errors: errors.slice(0, 10),
        }),
        { status: 400, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        imported: importedIds.length,
        total: rows.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        message:
          errors.length > 0
            ? `Imported ${importedIds.length} of ${rows.length} games. ${errors.length} rows had errors.`
            : `Successfully imported ${importedIds.length} games`,
      }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e: any) {
    console.error("Bulk import error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Failed to import games" }),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
