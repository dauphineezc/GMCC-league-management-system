// src/app/api/cron/daily-status-update/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verify this is coming from Vercel Cron (optional security)
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }
    
    console.log(`[${new Date().toISOString()}] Daily cron job triggered`);
    
    // Call our game status update endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const updateResponse = await fetch(`${baseUrl}/api/admin/update-game-statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await updateResponse.json();
    
    if (updateResponse.ok) {
      console.log('Daily status update completed:', result);
      return new Response(JSON.stringify({
        success: true,
        ...result
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    } else {
      console.error('Daily status update failed:', result);
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Update failed'
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }
    
  } catch (e: any) {
    console.error('Cron job error:', e);
    return new Response(JSON.stringify({
      success: false,
      error: e?.message || 'Cron job failed'
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
