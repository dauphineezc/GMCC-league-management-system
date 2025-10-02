import { kv } from '@vercel/kv';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return new Response(JSON.stringify({ error: 'key parameter required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const data = await kv.get(key);
    
    return new Response(JSON.stringify({ 
      key, 
      data,
      type: Array.isArray(data) ? 'array' : typeof data,
      length: Array.isArray(data) ? data.length : undefined
    }), {
      status: 200,
      headers: { 
        'content-type': 'application/json',
        'cache-control': 'no-store, max-age=0'
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to read KV' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
