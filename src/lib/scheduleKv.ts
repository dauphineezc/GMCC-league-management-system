// src/lib/scheduleKv.ts
export const SCHEDULE_KEY = (lid: string) => `league:${lid}:schedule:pdf`;

function must(v?: string | null, name = "env") {
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function rest<T = any>(op: "get" | "set" | "del", key: string, body?: any) {
  const base = must(process.env.KV_REST_API_URL, "KV_REST_API_URL");
  const tok  = must(process.env.KV_REST_API_TOKEN, "KV_REST_API_TOKEN");

  const url = `${base}/${op}/${encodeURIComponent(key)}`;
  const init: RequestInit = {
    method: op === "get" ? "GET" : "POST",
    headers: { Authorization: `Bearer ${tok}`, "content-type": "application/json" },
    cache: "no-store",
  };
  if (op !== "get" && body !== undefined) init.body = JSON.stringify(body);

  const r = await fetch(url, init);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`${op.toUpperCase()} ${key} failed ${r.status}: ${txt || r.statusText}`);
  }
  if (op === "get") {
    const j = await r.json().catch(() => null);
    return (j?.result ?? null) as T | null;
  }
  return null as unknown as T;
}

export async function kvGetRaw(key: string) {
  return rest("get", key);
}
export async function kvSetRaw(key: string, value: any) {
  await rest("set", key, value);
}
export async function kvDelRaw(key: string) {
  await rest("del", key);
}

export function parseDoc(raw: unknown) {
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw || null); } catch { return null; }
}
