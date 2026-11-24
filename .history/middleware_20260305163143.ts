import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// In-memory rate limit (Edge-compatible simple version)
const ipCounts = new Map<string, { count: number; resetAt: number }>();

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkEdgeRateLimit(
  ip: string,
  limit: number,
  windowMs: number,
  key: string
): boolean {
  const fullKey = `${key}:${ip}`;
  const now = Date.now();
  const entry = ipCounts.get(fullKey);

  if (!entry || entry.resetAt < now) {
    ipCounts.set(fullKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = getIp(req);

  // ── Security headers on every response ──────────────────────────────
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );

  // ── OTP endpoint — tight rate limit ─────────────────────────────────
  if (pathname === "/api/auth/send-otp") {
    if (!checkEdgeRateLimit(ip, 3, 60_000, "otp")) {
      return NextResponse.json(
        { message: "Too many OTP requests. Wait 1 minute." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // ── Auth-required API routes — verify JWT early ──────────────────────
  const protectedApiPrefixes = [
    "/api/dishes",
    "/api/swaps",
    "/api/credits",
    "/api/users",
    "/api/admin",
    "/api/chat",
  ];

  const isProtectedApi = protectedApiPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // For write operations (POST/PUT/PATCH/DELETE), check token early
  if (isProtectedApi && req.method !== "GET") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { message: "Invalid or expired token" },
        { status: 401 }
      );
    }
  }

  // ── Admin routes — verify admin role ────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.slice(7) ?? "";
    const payload = verifyToken(token);
    if (!payload || !["ADMIN", "MODERATOR"].includes(payload.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  // ── General API rate limit ──────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    const limit = pathname.startsWith("/api/dishes") && req.method === "GET" ? 120 : 60;
    if (!checkEdgeRateLimit(ip, limit, 60_000, "api")) {
      return NextResponse.json(
        { message: "Rate limit exceeded. Please slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)",
  ],
};
