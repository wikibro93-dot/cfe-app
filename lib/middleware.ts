import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TOKEN_MAX_AGE_SECONDS } from "./jwt";
import { prisma } from "./db";

/** Name of the httpOnly auth cookie. The token is never stored in localStorage. */
export const AUTH_COOKIE_NAME = "cfe_token";

/**
 * Resolve the signed-in user from the request. Accepts a Bearer token
 * (kept for non-browser clients) or the httpOnly `cfe_token` cookie.
 * A token is only trusted after real signature + expiry verification;
 * if the Bearer token fails verification we still try the cookie, so a
 * stale client header can never lock out a valid session.
 */
export async function getAuthUser(req: NextRequest) {
  const candidates: string[] = [];
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) candidates.push(authHeader.slice(7));
  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookie) candidates.push(cookie);

  for (const token of candidates) {
    const payload = verifyToken(token);
    if (!payload) continue;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (user) return user;
  }
  return null;
}

/** Set the auth cookie: httpOnly (not readable by JS), Secure in production, SameSite=Lax. */
export function setAuthCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });
  return res;
}

/** Clear the auth cookie (logout). */
export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ message }, { status: 404 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ message }, { status: 500 });
}

export function success<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
