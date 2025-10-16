import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getServerUser } from '@/lib/serverUser';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user || !user.superadmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');
    
    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 });
    }

    console.log('🔍 Debug: Inspecting league admin data for:', leagueId);

    // Get all relevant keys
    const leagueDoc = await kv.get(`league:${leagueId}`);
    const separateAdminUid = await kv.get(`league:${leagueId}:adminUserId`);
    
    // Get all admin: keys
    const adminKeys = await kv.keys('admin:*');
    const adminLeagues = await Promise.all(
      adminKeys.map(async (key) => {
        const leagues = await kv.smembers(key);
        return { key, leagues };
      })
    );

    // Get all user: keys for potential admins
    const userKeys = await kv.keys('user:*');
    const userData = await Promise.all(
      userKeys.slice(0, 10).map(async (key) => { // Limit to first 10 for performance
        const data = await kv.hgetall(key);
        return { key, data };
      })
    );

    return NextResponse.json({
      leagueId,
      leagueDoc,
      separateAdminUid,
      adminKeys: adminKeys.slice(0, 20), // Limit for readability
      adminLeagues: adminLeagues.filter(a => a.leagues.includes(leagueId)),
      userData: userData.filter(u => u.data && Object.keys(u.data).length > 0),
      allKeys: await kv.keys('*').then(keys => keys.filter(k => k.includes(leagueId)))
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
