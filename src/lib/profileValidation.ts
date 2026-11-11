/**
 * Shared client/server validation for account profile fields.
 * Keep this free of server-only imports so UI can reuse it.
 */

export type ParseOk<T> = { ok: true; value: T };
export type ParseErr = { ok: false; error: string };
export type ParseResult<T> = ParseOk<T> | ParseErr;

/** Letter groups separated by spaces / ' / - / ., optional trailing period (Jr.). */
const NAME_RE = /^[A-Za-z]+(?:[ '\-.]+[A-Za-z]+)*\.?$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_CHARS_RE = /^\+?[\d\s().\-]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Letters a–z plus spaces, apostrophes, periods, and hyphens (e.g. Mary-Jane, O'Brien, St. John). */
export function parsePersonName(
  value: unknown,
  label = "Name"
): ParseResult<string> {
  if (value == null) {
    return { ok: false, error: `${label} is required` };
  }
  const trimmed = String(value).trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { ok: false, error: `${label} is required` };
  }
  if (trimmed.length > 40) {
    return { ok: false, error: `${label} is too long` };
  }
  if (!NAME_RE.test(trimmed)) {
    return {
      ok: false,
      error: `${label} can only include letters and punctuation like spaces, apostrophes, periods, and hyphens`,
    };
  }
  return { ok: true, value: trimmed };
}

export function parseDob(value: unknown): ParseResult<string | null> {
  if (value == null) return { ok: true, value: null };
  const s = String(value).trim();
  if (!s) return { ok: true, value: null };

  if (!DOB_RE.test(s)) {
    return { ok: false, error: "Date of birth must be in YYYY-MM-DD format" };
  }

  const [yStr, mStr, dStr] = s.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const d = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return { ok: false, error: "Invalid date of birth" };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  if (year > currentYear) {
    return { ok: false, error: "Date of birth year cannot be in the future" };
  }
  if (year < 1900) {
    return { ok: false, error: "Please enter a valid date of birth" };
  }

  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getTime() > todayUtc) {
    return { ok: false, error: "Date of birth cannot be in the future" };
  }

  return { ok: true, value: s };
}

export function parseEmail(value: unknown): ParseResult<string> {
  if (value == null) {
    return { ok: false, error: "Email is required" };
  }
  const email = String(value).trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Email is required" };
  }
  if (email.length > 254) {
    return { ok: false, error: "Email is too long" };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  return { ok: true, value: email };
}

/**
 * Accepts common formatting and an optional country code.
 * The national number must be exactly 10 digits after removing punctuation
 * and any leading country code (1–3 digits).
 * Stored as "(XXX) XXX-XXXX" for +1 / NANP, otherwise "+CC XXXXXXXXXX".
 */
export function parsePhone(value: unknown): ParseResult<string | null> {
  if (value == null) return { ok: true, value: null };
  const raw = String(value).trim();
  if (!raw) return { ok: true, value: null };

  if (raw.length > 30) {
    return { ok: false, error: "Phone number is too long" };
  }
  if (!PHONE_CHARS_RE.test(raw)) {
    return {
      ok: false,
      error: "Phone number can only include digits, spaces, and ()+.-",
    };
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return { ok: false, error: "Enter a valid phone number" };
  }

  let country = "1";
  let national = digits;

  if (digits.length === 10) {
    national = digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    country = "1";
    national = digits.slice(1);
  } else if (digits.length >= 11 && digits.length <= 13) {
    // 1–3 digit country code + 10-digit national number
    const ccLen = digits.length - 10;
    country = digits.slice(0, ccLen);
    national = digits.slice(ccLen);
  } else {
    return {
      ok: false,
      error:
        "Enter a 10-digit phone number. Country code is optional (e.g. +1 555-123-4567).",
    };
  }

  if (national.length !== 10 || !/^\d{10}$/.test(national)) {
    return {
      ok: false,
      error:
        "Enter a 10-digit phone number. Country code is optional (e.g. +1 555-123-4567).",
    };
  }

  const formatted =
    country === "1"
      ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
      : `+${country} ${national}`;

  return { ok: true, value: formatted };
}
