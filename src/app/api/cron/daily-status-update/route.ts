// src/app/api/cron/daily-status-update/route.ts
import { NextRequest } from 'next/server';
import { assertCronJob, isAuthFailure } from '@/lib/authGuards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await assertCronJob(req);
    if (isAuthFailure(auth)) return auth.response;
    
    console.log(`[${new Date().toISOString()}] Daily cron job triggered`);
    
    // Call our game status update endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'CRON_SECRET is not configured' }), { status: 500 });
    }

    const cronHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.CRON_SECRET) {
      cronHeaders.Authorization = `Bearer ${process.env.CRON_SECRET}`;
    }

    const updateResponse = await fetch(`${baseUrl}/api/admin/update-game-statuses`, {
      method: 'POST',
      headers: cronHeaders,
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
