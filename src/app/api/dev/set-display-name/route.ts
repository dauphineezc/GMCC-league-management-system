// /src/app/api/dev/set-display-name/route.ts
import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  const { email, uid, name } = await req.json();
  try {
    const user = uid ? await adminAuth.getUser(uid) : await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(user.uid, { displayName: name });
    return Response.json({ ok: true, uid: user.uid, displayName: name });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? "update failed" }, { status: 500 });
  }
}