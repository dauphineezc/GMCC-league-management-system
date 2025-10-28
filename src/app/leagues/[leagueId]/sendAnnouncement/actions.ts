// src/app/leagues/[leagueId]/sendAnnouncement/actions.ts
"use server";

import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import { adminAuth } from "@/lib/firebaseAdmin";

/** ================== Types ================== */
type LeaguePlayerRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paymentStatus?: "PAID" | "UNPAID";
};

type UserProfile = {
  id?: string;
  email: string;
  name: string;
};

type MailjetRecipient = { Email: string; Name?: string };

/** ================== Config ================== */
// US as default (your account is US). You can override with MAILJET_BASE_URL if needed.
const MJ_BASE =
  process.env.MAILJET_BASE_URL?.replace(/\/+$/, "") || "https://api.mailjet.com";

const MJ_DEBUG = process.env.MJ_DEBUG_PROBE === "1";

/** ================== Utils ================== */
function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function extractIdFromHref(href?: string | null): string | null {
  if (!href) return null;
  const m = href.match(/\/message\/(\d+)$/);
  return m?.[1] ?? null;
}

async function isAdminOfLeague(userId: string, leagueId: string) {
  try {
    const inPerLeagueSet = await kv.sismember<string>(
      `league:${leagueId}:admins`,
      userId
    );
    if (inPerLeagueSet) return true;
  } catch {}

  try {
    const isMember = await kv.sismember<string>(
      `admin:${userId}:leagues`,
      leagueId
    );
    if (isMember) return true;
  } catch {}

  // also support legacy JSON list
  try {
    const val = await kv.get<any>(`admin:${userId}:leagues`);
    if (Array.isArray(val)) return val.includes(leagueId);
    if (typeof val === "string") {
      try {
        const arr = JSON.parse(val);
        if (Array.isArray(arr)) return arr.includes(leagueId);
      } catch {}
    }
  } catch {}

  return false;
}

/** ================== Core Action ================== */
export async function sendAnnouncementAction(formData: FormData) {
  const subject = (formData.get("subject") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  const managersOnly = formData.get("managersOnly") === "on";
  const paymentFilter = (formData.get("paymentFilter") as string) || "all"; // all | paid | unpaid
  const leagueId = (formData.get("leagueId") as string)?.trim();

  const user = await getServerUser();
  if (!user) redirect("/login");

  const ok = await isAdminOfLeague(user.id, leagueId);
  if (!ok) throw new Error("You do not have admin access to this league.");
  if (!subject || !message) throw new Error("Subject and message are required.");

  // --- Load & filter league players ---
  const leaguePlayersKey = `league:${leagueId}:players`;
  const leaguePlayers = (await kv.get<LeaguePlayerRow[]>(leaguePlayersKey)) ?? [];

  let filtered = managersOnly
    ? leaguePlayers.filter((p) => p.isManager)
    : leaguePlayers;

  if (paymentFilter === "paid")
    filtered = filtered.filter((p) => p.paymentStatus === "PAID");
  else if (paymentFilter === "unpaid")
    filtered = filtered.filter((p) => p.paymentStatus === "UNPAID");

  const uniqueUserIds = Array.from(new Set(filtered.map((p) => p.userId)));
  console.log(
    "Filtered players:",
    filtered.length,
    "Unique user IDs:",
    uniqueUserIds.length
  );

  // --- Resolve user profiles/emails from Firebase Auth, fallback KV ---
  const profiles = await Promise.all(
    uniqueUserIds.map(async (uid) => {
      try {
        const fu = await adminAuth.getUser(uid);
        if (fu.email) {
          return {
            email: fu.email,
            name: fu.displayName || fu.email,   // <- always a string
          } as UserProfile;
        }
      } catch (e: any) {
        if (e?.code !== "auth/user-not-found") {
          console.error(`Failed to get Firebase user for ${uid}:`, e?.code);
        }
      }
  
      const profile = await kv.get<any>(`user:${uid}`);
      if (profile?.email) {
        const nm =
          String(profile.displayName || profile.name || profile.email).trim();
        return {
          email: String(profile.email),
          name: nm,                            // <- always a string
        } as UserProfile;
      }
  
      return null; // keep nulls when no email
    })
  );  

  function notNull<T>(v: T | null | undefined): v is T {
    return v != null;
  }

  const recipients: { Email: string; Name?: string }[] = profiles
    .filter(notNull) // now narrowed to UserProfile[]
    .map((u) => ({
      Email: u.email.trim(),
      Name: u.name.trim(),
    }))
    .filter((r) => r.Email.includes("@"));

  console.log("Recipients found:", recipients.length);
  console.log(
    "Recipients:",
    recipients.map((r) => `${r.Name} (${r.Email})`)
  );

  if (recipients.length === 0) {
    throw new Error("No recipients found for the selected filters.");
  }

  // --- Mailjet config ---
  const FROM_EMAIL = process.env.MAILJET_SENDER_EMAIL!;
  const FROM_NAME = process.env.MAILJET_SENDER_NAME || "GMCC Leagues";
  const API_KEY = process.env.MAILJET_API_KEY!;
  const API_SECRET = process.env.MAILJET_API_SECRET!;
  if (!API_KEY || !API_SECRET || !FROM_EMAIL) {
    throw new Error(
      "Mail configuration missing (MAILJET_API_KEY, MAILJET_API_SECRET, MAILJET_SENDER_EMAIL)."
    );
  }

  // Non-secret fingerprint to guarantee same creds across envs
  console.log(
    "MJ fp:",
    Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64").slice(0, 12)
  );
  console.log("Mailjet config:", {
    FROM_EMAIL,
    FROM_NAME,
    API_KEY: "***",
    API_SECRET: "***",
    MJ_BASE,
  });

  if (!FROM_EMAIL.includes("@greatermidland.org")) {
    console.warn("FROM_EMAIL is not on expected domain:", FROM_EMAIL);
  }

  // --- Build content ---
  const textPart = message;
  const htmlPart =
    `<div style="font-family:'Montserrat','Segoe UI','Helvetica Neue',Arial,Helvetica,sans-serif;line-height:1.5;white-space:pre-wrap">` +
    `<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>` +
    `</div>`;

  // --- Send in batches of 50 (Mailjet supports up to 50 per message in v3.1) ---
  const batches = chunk(recipients, 50);
  const results: { batch: number; status: number; error?: any }[] = [];

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
          // Tracking hints help surface events sooner in history
          TrackOpens: "enabled" as const,
          TrackClicks: "enabled" as const,
          CustomID: `league_${leagueId}_announcement_${Date.now()}_${i}`,
          SandboxMode: false,
        },
      ],
    };

    const endpoint = `${MJ_BASE}/v3.1/send`;
    console.log(
      `Sending batch ${i + 1}/${batches.length} to ${batch.length} recipients`
    );

    // Handle occasional 429 with tiny backoff
    let sendRes: Response | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64"),
        },
        body: JSON.stringify(payload),
      });

      if (r.status !== 429) {
        sendRes = r;
        break;
      }
      console.warn("Mailjet 429 on send; backing off (attempt", attempt, ")");
      await sleep(500 * attempt);
    }

    const res = sendRes!;
    if (!res.ok) {
      let error: any = {};
      try {
        error = await res.json();
      } catch {}
      console.error(`Mailjet batch ${i + 1} failed:`, res.status, error);
      results.push({ batch: i + 1, status: res.status, error });
      continue;
    }

    const data = await res.json();
    const toArray = data.Messages?.[0]?.To ?? [];
    const debugIds = toArray.map((t: any) => ({
      Email: t.Email,
      MessageUUID: t.MessageUUID,
      // v3.1 shared "MessageID" — not the per-recipient ID:
      MessageID_shared: t.MessageID,
      MessageHref: t.MessageHref,
      PerRecipientId: extractIdFromHref(t.MessageHref),
    }));
    console.log("Mailjet IDs:", debugIds);

    // Optional, best-effort diagnostics only (don’t block UX)
    if (MJ_DEBUG) {
      const authHeader =
        "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64");
      for (const rec of debugIds) {
        if (!rec.PerRecipientId) continue;

        // Try messagehistory first (more reliable to show *some* event)
        try {
          const h = await fetch(
            `${MJ_BASE}/v3/REST/messagehistory/${rec.PerRecipientId}`,
            { headers: { Authorization: authHeader } }
          );
          console.log(
            `history ${rec.Email} → ${h.status}`,
            await h.text()
          );
        } catch (e) {
          console.warn("history probe failed:", e);
        }

        // Then /message (may lag indexing)
        try {
          const m = await fetch(
            `${MJ_BASE}/v3/REST/message/${rec.PerRecipientId}`,
            { headers: { Authorization: authHeader } }
          );
          console.log(`message ${rec.Email} → ${m.status}`, await m.text());
        } catch (e) {
          console.warn("message probe failed:", e);
        }
      }
    }

    results.push({ batch: i + 1, status: 200 });
  }

  const failures = results.filter((r) => r.status >= 400);
  if (failures.length) {
    const details = failures
      .map((f) => `batch ${f.batch} → ${f.status} ${JSON.stringify(f.error)}`)
      .join("; ");
    throw new Error(
      `Some batches failed to send. Sent ${
        results.length - failures.length
      }/${results.length}. Details: ${details}`
    );
  }

  return { ok: true, sentBatches: results.length, recipients: recipients.length };
}