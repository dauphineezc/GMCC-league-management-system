import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

const SECRET = process.env.ADMIN_CLAIMS_SECRET!;

export async function POST(req: Request) {
  const token = req.headers.get("x-admin-token");
  if (!SECRET || token !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uidOrEmail, claims } = await req.json();

  let uid = uidOrEmail as string;
  if (uid.includes("@")) {
    const u = await adminAuth.getUserByEmail(uid);
    uid = u.uid;
  }
  await adminAuth.setCustomUserClaims(uid, claims);

  return NextResponse.json({ ok: true, uid, claims });
}