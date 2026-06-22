/** SCAN via Upstash REST API (no extra @upstash/redis dependency). */
export async function scanKeys(pattern: string): Promise<string[]> {
  const base = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!base || !token) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required for export");
  }

  const keys: string[] = [];
  let cursor = 0;

  do {
    const url = `${base}/scan/${cursor}?match=${encodeURIComponent(pattern)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`SCAN failed ${res.status}: ${txt || res.statusText}`);
    }

    const body = (await res.json()) as { result?: [number | string, string[]] };
    const nextCursor = Number(body.result?.[0] ?? 0);
    const batch = body.result?.[1] ?? [];
    keys.push(...batch.map(String));
    cursor = nextCursor;
  } while (cursor !== 0);

  return keys;
}
