import { kv } from '@vercel/kv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    
    if (!key) {
      return new Response('Missing key parameter', { status: 400 });
    }
    
    console.log(`Checking KV key: ${key}`);
    const data = await kv.get(key);
    
    const result = {
      key,
      exists: !!data,
      type: typeof data,
      dataPreview: data ? JSON.stringify(data).substring(0, 200) + '...' : null
    };
    
    console.log('KV check result:', result);
    
    return new Response(JSON.stringify(result, null, 2), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error) {
    console.error('KV check error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
