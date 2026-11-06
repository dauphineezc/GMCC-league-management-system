/**
 * Only allow same-origin relative paths (blocks open redirects).
 * Browsers treat "\" as "/" and strip tabs/newlines, so "/\evil.com" and
 * "/\t/evil.com" both become the protocol-relative "//evil.com".
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.startsWith("//")) return null;
  return value;
}
