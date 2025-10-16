import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/serverUser';
import { getAdminDisplayName } from '@/lib/adminUserLookup';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser();
    if (!user || !user.superadmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const adminUserId = searchParams.get('adminUserId') || 'admin-a';
    
    console.log('🧪 Testing admin lookup for:', adminUserId);
    
    const result = await getAdminDisplayName(adminUserId);
    
    return NextResponse.json({
      adminUserId,
      result,
      success: true
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
