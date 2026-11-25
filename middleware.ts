import { NextRequest, NextResponse } from "next/server";

/**
 * Root middleware (Edge runtime). It only applies security headers — it
 * deliberately does NOT verify JWTs: jsonwebtoken is Node-only and cannot
 * run on the Edge. Authentication is enforced per API route by
 * getAuthUser() in lib/middleware.ts (Node runtime).
 *
 * The header set is duplicated from lib/ratelimit.ts addSecurityHeaders()
 * (same values) because middleware cannot import the Upstash-backed
 * ratelimit module safely on the Edge.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // needed for Next.js
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
    "connect-src 'self' wss: https://api.cloudinary.com https://exchangeratesapi.io",
    "frame-ancestors 'none'",
  ].join("; "),
};

export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)"],
};
