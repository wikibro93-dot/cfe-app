// Helpers for calling Next.js route handlers in tests (node environment).
// Requests are real NextRequest objects; auth is a real signed JWT cookie,
// so getAuthUser / verifyToken run for real. The database stays mocked
// (see prismaMock.ts) — no network, no real SMS, no real secrets.

import { NextRequest } from "next/server";
import { signToken } from "@/lib/jwt";

// CI sets a dummy JWT_SECRET; fall back to a test-only secret locally.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = "test-jwt-secret-for-jest-only-0123456789";
}

// Rate limiting is real (in-memory fallback) and keyed by IP, so every
// request gets its own IP unless a test deliberately reuses one.
let ipSeq = 0;
export function nextIp(): string {
  ipSeq += 1;
  return `10.20.30.${(ipSeq % 200) + 1}`;
}

export interface ReqOpts {
  method?: string;
  body?: unknown;
  rawBody?: string;
  /** Sign in as this user (real JWT in the cfe_token cookie). */
  user?: { id: string; phone: string; role: string };
  /** Raw token string to put in the cookie (e.g. a forged/expired token). */
  token?: string;
  /** Extra headers. Pass `ip` here to reuse one IP across requests. */
  headers?: Record<string, string>;
  ip?: string;
}

export function makeReq(path: string, opts: ReqOpts = {}): NextRequest {
  const headers: Record<string, string> = {
    "x-forwarded-for": opts.ip ?? nextIp(),
    ...(opts.headers ?? {}),
  };
  if (opts.user) {
    headers.cookie = `cfe_token=${signToken({
      userId: opts.user.id,
      phone: opts.user.phone,
      role: opts.user.role,
    })}`;
  } else if (opts.token) {
    headers.cookie = `cfe_token=${opts.token}`;
  }
  const init: Record<string, unknown> = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    headers["content-type"] = "application/json";
  }
  if (opts.rawBody !== undefined) init.body = opts.rawBody;
  return new NextRequest(`http://localhost:3000${path}`, init as RequestInit);
}

/** Read a route handler's JSON response body. */
export async function readBody(res: Response): Promise<any> {
  return res.json();
}
