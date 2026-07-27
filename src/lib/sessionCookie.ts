import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_COOKIE = "fb:session";

const isProd = process.env.NODE_ENV === "production";

export function clearSessionCookieOptions(): ResponseCookie[] {
  return [
    {
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    },
    {
      name: SESSION_COOKIE,
      value: "",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
      maxAge: 0,
      path: "/",
    },
  ];
}

export function createSessionCookieOptions(maxAge: number): ResponseCookie {
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
