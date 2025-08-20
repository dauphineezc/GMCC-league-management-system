// Small helpers to read userId from headers/cookies
import { cookies, headers } from "next/headers";

export function getUserIdFromRequest(): string | null {
  const h = headers();
  return h.get("x-user-id") || cookies().get("userId")?.value || null;
}

export function requireUser(): string {
  const uid = getUserIdFromRequest();
  if (!uid) throw new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "Login required" }}), { status: 401 });
  return uid;
}
