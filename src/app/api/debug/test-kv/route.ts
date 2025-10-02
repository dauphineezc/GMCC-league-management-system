import { kv } from '@vercel/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { key, data } = await req.json();
    
    console.log(`TEST: Setting key ${key} with data:`, JSON.stringify(data).substring(0, 100));
    
    // Write the data
    await kv.set(key, data);
    
    // Immediate verification
    const immediate = await kv.get(key);
    console.log(`TEST: Immediate read:`, immediate ? 'FOUND' : 'NOT FOUND');
    
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 100));
    const delayed = await kv.get(key);
    console.log(`TEST: Delayed read:`, delayed ? 'FOUND' : 'NOT FOUND');
    
    // Try with a different key pattern
    const altKey = `${key}:test`;
    await kv.set(altKey, data);
    const altRead = await kv.get(altKey);
    console.log(`TEST: Alt key (${altKey}):`, altRead ? 'FOUND' : 'NOT FOUND');
    
    return new Response(JSON.stringify({
      immediate: !!immediate,
      delayed: !!delayed,
      altKey: !!altRead,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    console.error('TEST KV error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return new Response('Missing key parameter', { status: 400 });
    }
    
    const data = await kv.get(key);
    
    return new Response(JSON.stringify({
      key,
      found: !!data,
      type: typeof data,
      preview: data ? JSON.stringify(data).substring(0, 200) : null
    }, null, 2), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
