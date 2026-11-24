import { NextRequest, NextResponse } from "next/server";

// In-memory store for rate limiting (use Upstash Redis in production for multi-instance)
const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  limit: number;
  windowMs: number; // milliseconds
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "send-otp":    { limit: 3,   windowMs: 60_000 },       // 3 per minute
  "verify-otp":  { limit: 5,   windowMs: 60_000 },       // 5 per minute
  "api-general": { limit: 120, windowMs: 60_000 },       // 120 per minute
  "api-write":   { limit: 30,  windowMs: 60_000 },       // 30 writes per minute
  "api-search":  { limit: 60,  windowMs: 60_000 },       // 60 searches per minute
};

function getIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  return ip;
}

export function rateLimit(
  req: NextRequest,
  tier: keyof typeof RATE_LIMITS = "api-general"
): { success: boolean; remaining: number; reset: number; response?: NextResponse } {
  const config = RATE_LIMITS[tier];
  const key = `${tier}:${getIdentifier(req)}`;
  const now = Date.now();

  // Clean expired entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of store.entries()) {
      if (v.resetAt < now) store.delete(k);
    }
  }

  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.limit - 1, reset: now + config.windowMs };
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const response = NextResponse.json(
      { message: "Too many requests. Please slow down.", retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": config.limit.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": entry.resetAt.toString(),
        },
      }
    );
    return { success: false, remaining: 0, reset: entry.resetAt, response };
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    reset: entry.resetAt,
  };
}

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // needed for Next.js
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org",
      "connect-src 'self' wss: https://api.cloudinary.com https://exchangeratesapi.io",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  return response;
}
