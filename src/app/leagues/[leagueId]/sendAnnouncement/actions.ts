"use server";

import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import { adminAuth } from "@/lib/firebaseAdmin";

type LeaguePlayerRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paymentStatus?: "PAID" | "UNPAID";
};

type UserProfile = {
  id: string;
  email: string;
  name?: string;
};

async function isAdminOfLeague(userId: string, leagueId: string) {
  // 1) Check per-league admins set
  try {
    const inPerLeagueSet = await kv.sismember<string>(`league:${leagueId}:admins`, userId);
    if (inPerLeagueSet) return true;
  } catch { /* ignore */ }

  // 2) Try per-user leagues stored as JSON string or array
  try {
    const val = await kv.get<any>(`admin:${userId}:leagues`);
    if (Array.isArray(val)) return val.includes(leagueId);
    if (typeof val === "string") {
      try {
        const arr = JSON.parse(val);
        if (Array.isArray(arr)) return arr.includes(leagueId);
      } catch { /* ignore */ }
    }
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("WRONGTYPE")) {
      // 3) If it’s a Set, use SISMEMBER/SMEMBERS
      try {
        const isMember = await kv.sismember<string>(`admin:${userId}:leagues`, leagueId);
        if (isMember) return true;

        const setMembers = (await kv.smembers(`admin:${userId}:leagues`)) as string[];
        return Array.isArray(setMembers) && setMembers.includes(leagueId);
      } catch { /* ignore */ }
    } else {
      throw err;
    }
  }

  return false;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function sendAnnouncementAction(formData: FormData) {
  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  const managersOnly = formData.get("managersOnly") === "on";
  const paymentFilter = (formData.get("paymentFilter") as string) || "all"; // all | paid | unpaid
  const leagueId = (formData.get("leagueId") as string)?.trim();

  const user = await getServerUser();
  if (!user) redirect("/login");

  // IMPORTANT: use user.uid (your app uses uid elsewhere)
  const ok = await isAdminOfLeague(user.id, leagueId);
  if (!ok) throw new Error("You do not have admin access to this league.");
  if (!subject || !message) throw new Error("Subject and message are required.");

  const leaguePlayersKey = `league:${leagueId}:players`;
  const leaguePlayers = (await kv.get<LeaguePlayerRow[]>(leaguePlayersKey)) ?? [];

  // managers only
  let filtered = managersOnly ? leaguePlayers.filter((p) => p.isManager) : leaguePlayers;

  // payment filter
  if (paymentFilter === "paid") filtered = filtered.filter((p) => p.paymentStatus === "PAID");
  else if (paymentFilter === "unpaid") filtered = filtered.filter((p) => p.paymentStatus === "UNPAID");

  // dedupe by userId then join to user profiles for emails
  const uniqueUserIds = Array.from(new Set(filtered.map((p) => p.userId)));
  
  // Debug logging
  console.log("Filtered players:", filtered.length, "Unique user IDs:", uniqueUserIds.length);
  
  const userProfiles = await Promise.all(
    uniqueUserIds.map(async (uid) => {
      try {
        // Try to get user from Firebase Auth first
        const firebaseUser = await adminAuth.getUser(uid);
        if (firebaseUser.email) {
          return {
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email
          };
        }
      } catch (e: any) {
        // Only log if it's not a "user-not-found" error (expected for mock users)
        if (e.code !== "auth/user-not-found") {
          console.error(`Failed to get Firebase user for ${uid}:`, e.code);
        }
      }
      
      // Fallback to KV store
      const profile = await kv.get<any>(`user:${uid}`);
      if (profile?.email) {
        return {
          email: profile.email,
          name: profile.displayName || profile.name || profile.email
        };
      }
      
      return null;
    })
  );

  const recipients = userProfiles
    .filter(Boolean)
    .map((u) => ({
      Email: u!.email,
      Name: u!.name || u!.email,
    }));

  // Debug logging
  console.log("Recipients found:", recipients.length);
  console.log("Recipients:", recipients.map(r => `${r.Name} (${r.Email})`));

  if (recipients.length === 0) {
    throw new Error("No recipients found for the selected filters.");
  }

  // Mailjet config
  const FROM_EMAIL = process.env.MAILJET_SENDER_EMAIL!;
  const FROM_NAME = process.env.MAILJET_SENDER_NAME || "GMCC Leagues";
  const API_KEY = process.env.MAILJET_API_KEY!;
  const API_SECRET = process.env.MAILJET_API_SECRET!;
  if (!API_KEY || !API_SECRET || !FROM_EMAIL) {
    throw new Error("Mail configuration missing (MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_SENDER_EMAIL).");
  }

  console.log("Mailjet config:", { FROM_EMAIL, FROM_NAME, API_KEY: API_KEY ? "***" : "missing", API_SECRET: API_SECRET ? "***" : "missing" });

  const endpoint = "https://api.mailjet.com/v3.1/send";
  const batches = chunk(recipients, 50);
  const results: { batch: number; status: number; error?: any }[] = [];

  const textPart = message;
  const htmlPart = `<div style="font-family:'Montserrat','Segoe UI','Helvetica Neue',Arial,Helvetica,sans-serif; line-height:1.5; white-space:pre-wrap">
<p>${message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>")}</p>
</div>`;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    const payload = {
      Messages: [
        {
          From: { Email: FROM_EMAIL, Name: FROM_NAME },
          To: batch,
          Subject: subject,
          TextPart: textPart,
          HTMLPart: htmlPart,
          CustomID: `league_${leagueId}_announcement_${Date.now()}_${i}`,
        },
      ],
    };

    console.log(`Sending batch ${i + 1}/${batches.length} to ${batch.length} recipients`);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64"),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let error: any = {};
      try { error = await res.json(); } catch {}
      console.error(`Mailjet batch ${i + 1} failed:`, res.status, error);
      results.push({ batch: i + 1, status: res.status, error });
    } else {
      const responseData = await res.json();
      console.log(`Mailjet batch ${i + 1} succeeded:`, JSON.stringify(responseData, null, 2));
      console.log("Message URLs:", responseData.Messages?.[0]?.To?.map((t: any) => t.MessageHref));
      results.push({ batch: i + 1, status: res.status });
    }
  }

  const failures = results.filter((r) => r.status >= 400);
  if (failures.length) {
    const details = failures.map((f) => `batch ${f.batch} → ${f.status} ${JSON.stringify(f.error)}`).join("; ");
    throw new Error(`Some batches failed to send. Sent ${results.length - failures.length}/${results.length}. Details: ${details}`);
  }

  return { ok: true, sentBatches: results.length, recipients: recipients.length };
}