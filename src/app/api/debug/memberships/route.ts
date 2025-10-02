export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { readMembershipsForUid } from "@/lib/kvread";

function typeOf(v: unknown) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v;
}

export async function GET(req: Request) {
  try {
    const me = await getServerUser();
    if (!me) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = new URL(req.url);
    // allow explicit uid for debugging; lock down later if you want
    const uid = url.searchParams.get("uid") || me.id;
    const email = me.email ?? null;

    const result = await readMembershipsForUid(uid, email);

    const rawHash = await kv.hgetall(`user:${uid}`);
    const rawGet  = await kv.get(`user:${uid}:memberships`);
    const rawSet  = await kv.smembers(`user:${uid}:memberships`).catch(() => null);
    const legacy  = email ? await kv.get(`user:${email}:memberships`) : null;

    return NextResponse.json({
      who: { uid, email },
      result,
      types: {
        hash: typeOf(rawHash),
        get:  typeOf(rawGet),
        set:  typeOf(rawSet),
        legacy: typeOf(legacy),
      },
      raw: {
        // trim/summarize so the payload stays readable
        hashKeys: rawHash && typeof rawHash === "object" ? Object.keys(rawHash) : null,
        getPreview: typeof rawGet === "string" ? rawGet.slice(0, 120) : rawGet,
        setLen: Array.isArray(rawSet) ? rawSet.length : null,
        legacyPreview: typeof legacy === "string" ? legacy.slice(0, 120) : legacy,
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Debug route failed" },
      { status: 500 }
    );
  }
}