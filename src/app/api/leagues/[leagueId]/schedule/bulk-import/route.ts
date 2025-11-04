// src/app/api/leagues/[leagueId]/schedule/bulk-import/route.ts
import { kv } from "@vercel/kv";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import cpf from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(tz);
dayjs.extend(cpf);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseKV(raw: unknown): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = raw.trim() ? JSON.parse(raw) : [];
    return parsed;
  }
  return [];
}

interface CSVRow {
  homeTeamName: string;
  awayTeamName: string;
  date: string;
  time: string;
  location: string;
}

function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  const rows: CSVRow[] = [];
  
  // Check if first row is a header (contains common header keywords)
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes('home') || firstLine.includes('away') || 
                    firstLine.includes('date') || firstLine.includes('time');
  
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line) continue;
    
    // Simple CSV parser - handles quoted fields
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim()); // Push the last field
    
    if (fields.length < 5) {
      throw new Error(`Row ${i + (hasHeader ? 2 : 1)} has ${fields.length} columns, expected 5 (homeTeam, awayTeam, date, time, location)`);
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
      location: location.trim()
    });
  }
  
  return rows;
}

export async function POST(req: Request, { params }: { params: { leagueId: string } }) {
  try {
    const { leagueId } = params;
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const timezone = form.get("timezone") as string || "America/Detroit";
    
    if (!file) {
      return new Response(JSON.stringify({ error: "Missing CSV file" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    // Check file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return new Response(JSON.stringify({ error: "File must be a CSV (.csv)" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    // Read and parse CSV
    const csvText = await file.text();
    let rows: CSVRow[];
    
    try {
      rows = parseCSV(csvText);
    } catch (parseError: any) {
      return new Response(JSON.stringify({ 
        error: `CSV parsing error: ${parseError.message}` 
      }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No valid games found in CSV" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    // Get existing games
    const key = `league:${leagueId}:games`;
    let raw = await kv.get(key);
    
    if (!raw && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body?.result) {
        raw = body.result;
      }
    }

    const games = parseKV(raw);
    const newGames = [];
    const errors: string[] = [];

    // Create game objects from CSV rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        console.log(`[CSV Import] Processing row ${i + 2}:`, row);
        
        // Validate team names
        if (row.homeTeamName === row.awayTeamName) {
          errors.push(`Row ${i + 2}: Home and away teams cannot be the same`);
          continue;
        }

         // Parse and validate date/time
        let dateTimeISO: string;
        try {
          // Try different date formats
          const dateStr = row.date;
          const timeStr = row.time;
          
          // Try to parse date in various formats (including 2-digit years)
          const parsedDate = dayjs(dateStr, [
            'MM/DD/YYYY', 
            'M/D/YYYY', 
            'MM-DD-YYYY',
            'M/D/YY',      // Added: 11/8/25
            'MM/DD/YY',    // Added: 11/08/25
            'MM-DD-YY'     // Added: 11-08-25
          ], true);
          
          if (!parsedDate.isValid()) {
            errors.push(`Row ${i + 2}: Invalid date format "${dateStr}". Use MM/DD/YYYY, M/D/YY, M-D-YY, or MM-DD-YYYY`);
            console.log(`[CSV Import] Row ${i + 2} date parse failed: "${dateStr}"`);
            continue;
          }
          
          console.log(`[CSV Import] Row ${i + 2} date parsed: "${dateStr}" -> ${parsedDate.format('YYYY-MM-DD')}`);


          // Parse time (HH:mm or H:mm AM/PM)
          const parsedTime = dayjs(timeStr, ['HH:mm', 'H:mm', 'h:mm A', 'h:mm a', 'HH:mm:ss'], true);
          
          if (!parsedTime.isValid()) {
            errors.push(`Row ${i + 2}: Invalid time format "${timeStr}". Use HH:mm (24-hour) or h:mm AM/PM`);
            console.log(`[CSV Import] Row ${i + 2} time parse failed: "${timeStr}"`);
            continue;
          }
          
          console.log(`[CSV Import] Row ${i + 2} time parsed: "${timeStr}" -> ${parsedTime.format('HH:mm')}`);


          // Combine date and time
          const dateTimeStr = `${parsedDate.format('YYYY-MM-DD')}T${parsedTime.format('HH:mm')}`;
          dateTimeISO = dayjs.tz(dateTimeStr, timezone).toISOString();
          
        } catch (dateError: any) {
          errors.push(`Row ${i + 2}: Date/time parsing error - ${dateError.message}`);
          console.error(`[CSV Import] Row ${i + 2} exception:`, dateError);
          continue;
        }

        // Create new game
        const newGame = {
          id: crypto.randomUUID(),
          leagueId,
          homeTeamName: row.homeTeamName,
          awayTeamName: row.awayTeamName,
          location: row.location,
          dateTimeISO,
          status: 'scheduled'
        };

        newGames.push(newGame);
        console.log(`[CSV Import] Row ${i + 2} successfully created game`);
      } catch (rowError: any) {
        errors.push(`Row ${i + 2}: ${rowError.message}`);
        console.error(`[CSV Import] Row ${i + 2} error:`, rowError);
      }
    }
    
    console.log(`[CSV Import] Summary: ${newGames.length} games created, ${errors.length} errors`);
    if (errors.length > 0) {
      console.log(`[CSV Import] Errors:`, errors);
    }

    if (newGames.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No valid games could be imported",
        errors: errors.slice(0, 10) // Return first 10 errors
      }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    // Add all new games to existing games
    games.push(...newGames);

    // Save updated games
    const dataToWrite = JSON.stringify(games);
    const backupKey = `${key}:backup`;
    
    await Promise.all([
      kv.set(key, dataToWrite),
      kv.set(backupKey, dataToWrite),
    ]);

    console.log(`Successfully imported ${newGames.length} games to league ${leagueId}`);

    return new Response(JSON.stringify({ 
      ok: true,
      imported: newGames.length,
      total: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      message: errors.length > 0 
        ? `Imported ${newGames.length} of ${rows.length} games. ${errors.length} rows had errors.`
        : `Successfully imported ${newGames.length} games`
    }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    });

  } catch (e: any) {
    console.error('Bulk import error:', e);
    return new Response(JSON.stringify({ 
      error: e?.message || 'Failed to import games' 
    }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}

