// src/app/api/leagues/[leagueId]/standings/route.ts
import { kv } from '@vercel/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseKV(raw: unknown): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') return raw.trim() ? JSON.parse(raw) : [];
  return [];
}

export async function GET(req: Request, { params }: { params: { leagueId: string } }) {
  try {
    const { leagueId } = params;
    
    // Try to get existing standings
    const standingsKey = `league:${leagueId}:standings`;
    let rawStandings = await kv.get(standingsKey);
    
    if (!rawStandings && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(standingsKey)}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
        cache: "no-store",
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok && body?.result) {
        rawStandings = body.result;
      }
    }

    let standings = parseKV(rawStandings);

    // If no standings exist, calculate them
    if (standings.length === 0) {
      console.log('No standings found, calculating initial standings');
      
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const calculateUrl = `${baseUrl}/api/leagues/${leagueId}/standings/calculate`;
      const calculateResponse = await fetch(calculateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (calculateResponse.ok) {
        const result = await calculateResponse.json();
        standings = result.standings || [];
      } else {
        console.error('Failed to calculate initial standings');
      }
    }

    return new Response(JSON.stringify(standings), {
      status: 200,
      headers: { 
        'content-type': 'application/json',
        'cache-control': 'no-store'
      }
    });

  } catch (e: any) {
    console.error('Error fetching standings:', e);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
}