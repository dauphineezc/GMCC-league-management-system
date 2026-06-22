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

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  const rows: CSVRow[] = [];
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes("home") ||
    firstLine.includes("away") ||
    firstLine.includes("date") ||
    firstLine.includes("time");

  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;

    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());

    if (fields.length < 5) {
      throw new Error(
        `Row ${i + (hasHeader ? 2 : 1)} has ${fields.length} columns, expected 5 (homeTeam, awayTeam, date, time, location)`
      );
    }

    const [homeTeamName, awayTeamName, date, time, location] = fields;

    if (!homeTeamName || !awayTeamName || !date || !time || !location) {
      throw new Error(`Row ${i + (hasHeader ? 2 : 1)} has empty required fields`);
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
  const parsedDate = dayjs(
    row.date,
    ["MM/DD/YYYY", "M/D/YYYY", "MM-DD-YYYY", "M/D/YY", "MM/DD/YY", "MM-DD-YY"],
    true
  );

  if (!parsedDate.isValid()) {
    return {
      error: `Invalid date format "${row.date}". Use MM/DD/YYYY, M/D/YY, M-D-YY, or MM-DD-YYYY`,
    };
  }

  const parsedTime = dayjs(
    row.time,
    ["HH:mm", "H:mm", "h:mm A", "h:mm a", "HH:mm:ss"],
    true
  );

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
