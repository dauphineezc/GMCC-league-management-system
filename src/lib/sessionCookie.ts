import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_COOKIE = "fb:session";

const isProd = process.env.NODE_ENV === "production";

export function sessionCookieOptions(
  embedded: boolean,
  maxAge: number
): ResponseCookie {
  if (embedded) {
    return {
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      maxAge,
      path: "/",
    };
  }

  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge,
    path: "/",
  };
}
