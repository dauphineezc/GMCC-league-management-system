export type ChannelResult = {
  attempted: boolean;
  sent: boolean;
  error?: string;
};

export type InviteDelivery = {
  email: ChannelResult;
  sms: ChannelResult;
};

export type InviteKind = "code" | "link";

const skipped: ChannelResult = { attempted: false, sent: false };

export function parseOptionalEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const email = value.trim();
  if (!email) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
  }
  return email;
}

export function parseOptionalPhone(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (!raw) return undefined;
  const e164 = toE164(raw);
  if (!e164) {
    throw Object.assign(
      new Error("Enter a valid phone number, including country code (e.g. +12345678900)."),
      { status: 400 }
    );
  }
  return e164;
}

function toE164(raw: string): string | null {
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function inviteCopy(opts: {
  kind: InviteKind;
  teamName: string;
  code?: string;
  link?: string;
  expiresIn: number;
  joinUrl: string;
}) {
  const team = opts.teamName || "your team";
  if (opts.kind === "link" && opts.link) {
    return {
      subject: `You're invited to join ${team}`,
      text:
        `You've been invited to join ${team} on Greater Midland Community Center - League Management System.\n\n` +
        `Open this one-time link to join (you must be signed in):\n${opts.link}\n\n` +
        `This invite expires in ${opts.expiresIn} hours.`,
      sms:
        `Greater Midland Community Center - League Management System: Join ${team} with this one-time link: ${opts.link} (expires in ${opts.expiresIn}h)`,
    };
  }

  const code = opts.code || "";
  return {
    subject: `Your ${team} invite code`,
    text:
      `You've been invited to join ${team} on Greater Midland Community Center - League Management System.\n\n` +
      `Invite code: ${code}\n\n` +
      `Sign in, then enter this code on the Join page:\n${opts.joinUrl}\n\n` +
      `This code expires in ${opts.expiresIn} hours.`,
    sms:
      `Greater Midland Community Center - League Management System: Your ${team} invite code is ${code}. Enter it at ${opts.joinUrl}. Expires in ${opts.expiresIn}h.`,
  };
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendMailjetEmail(to: string, subject: string, text: string): Promise<void> {
  const FROM_EMAIL = process.env.MAILJET_SENDER_EMAIL;
  const FROM_NAME = process.env.MAILJET_SENDER_NAME || "Greater Midland Community Center - League Management System";
  const API_KEY = process.env.MAILJET_API_KEY;
  const API_SECRET = process.env.MAILJET_API_SECRET;
  const MJ_BASE =
    process.env.MAILJET_BASE_URL?.replace(/\/+$/, "") || "https://api.mailjet.com";

  if (!API_KEY || !API_SECRET || !FROM_EMAIL) {
    throw new Error("Email sending is not configured.");
  }

  const html =
    `<div style="font-family:'Montserrat','Segoe UI','Helvetica Neue',Arial,Helvetica,sans-serif;line-height:1.5;white-space:pre-wrap">` +
    `<p>${escapeHtml(text).replace(/\n/g, "<br/>")}</p>` +
    `</div>`;

  const endpoint = `${MJ_BASE}/v3.1/send`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64"),
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: FROM_EMAIL, Name: FROM_NAME },
          To: [{ Email: to }],
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
          CustomID: `invite_${Date.now()}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = raw;
    try {
      detail = JSON.stringify(JSON.parse(raw));
    } catch {
      // keep raw text
    }
    throw new Error(`Email failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
}

async function sendMailjetSms(to: string, text: string): Promise<void> {
  const token = process.env.MAILJET_SMS_TOKEN;
  const from = process.env.MAILJET_SMS_FROM || "Greater Midland Community Center - League Management System";
  const MJ_BASE =
    process.env.MAILJET_BASE_URL?.replace(/\/+$/, "") || "https://api.mailjet.com";

  if (!token) {
    throw new Error("SMS sending is not configured.");
  }

  const res = await fetch(`${MJ_BASE}/v4/sms-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ From: from, To: to, Text: text }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let detail = raw;
    try {
      detail = JSON.stringify(JSON.parse(raw));
    } catch {
      // keep raw text
    }
    throw new Error(`SMS failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }
}

export async function deliverInvite(opts: {
  email?: string;
  phone?: string;
  kind: InviteKind;
  teamName: string;
  code?: string;
  link?: string;
  expiresIn: number;
  joinUrl: string;
}): Promise<InviteDelivery> {
  const copy = inviteCopy(opts);
  const delivery: InviteDelivery = { email: skipped, sms: skipped };

  if (opts.email) {
    try {
      await sendMailjetEmail(opts.email, copy.subject, copy.text);
      delivery.email = { attempted: true, sent: true };
    } catch (err) {
      delivery.email = {
        attempted: true,
        sent: false,
        error: err instanceof Error ? err.message : "Failed to send email.",
      };
    }
  }

  if (opts.phone) {
    try {
      await sendMailjetSms(opts.phone, copy.sms);
      delivery.sms = { attempted: true, sent: true };
    } catch (err) {
      delivery.sms = {
        attempted: true,
        sent: false,
        error: err instanceof Error ? err.message : "Failed to send text message.",
      };
    }
  }

  return delivery;
}
