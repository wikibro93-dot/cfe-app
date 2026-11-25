import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting backed by Upstash Redis when configured, with an in-memory
 * fallback for local development. The in-memory fallback is single-instance
 * only (it resets on every serverless cold start and is not shared across
 * instances) — production MUST set UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN.
 */

interface RateLimitConfig {
  limit: number;
  windowMs: number; // milliseconds
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "send-otp": { limit: 3, windowMs: 60_000 }, // 3 per minute
  "verify-otp": { limit: 5, windowMs: 60_000 }, // 5 per minute
  "api-general": { limit: 120, windowMs: 60_000 }, // 120 per minute
  "api-write": { limit: 30, windowMs: 60_000 }, // 30 writes per minute
  "api-search": { limit: 60, windowMs: 60_000 }, // 60 searches per minute
};

// In-memory fallback store (dev only — see header comment).
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  return ip;
}

function upstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(tier: keyof typeof RATE_LIMITS): Ratelimit | null {
  if (!upstashConfigured()) return null;
  let limiter = upstashLimiters.get(tier);
  if (!limiter) {
    const config = RATE_LIMITS[tier];
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(
        config.limit,
        `${Math.round(config.windowMs / 1000)} s`
      ),
      analytics: true,
      prefix: `cfe:ratelimit:${tier}`,
    });
    upstashLimiters.set(tier, limiter);
  }
  return limiter;
}

function tooManyResponse(limit: number, resetAt: number): NextResponse {
  const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { message: "Too many requests. Please slow down.", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetAt.toString(),
      },
    }
  );
}

export async function rateLimit(
  req: NextRequest,
  tier: keyof typeof RATE_LIMITS = "api-general"
): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
  response?: NextResponse;
}> {
  const config = RATE_LIMITS[tier];
  const key = getIdentifier(req);
  const now = Date.now();

  const upstash = getUpstashLimiter(tier);
  if (upstash) {
    const { success, remaining, reset } = await upstash.limit(key);
    if (success) return { success: true, remaining, reset };
    return {
      success: false,
      remaining: 0,
      reset,
      response: tooManyResponse(config.limit, reset),
    };
  }

  // In-memory fallback (local development only).
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt < now) memoryStore.delete(k);
    }
  }

  const storeKey = `${tier}:${key}`;
  const entry = memoryStore.get(storeKey);

  if (!entry || entry.resetAt < now) {
    memoryStore.set(storeKey, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.limit - 1, reset: now + config.windowMs };
  }

  entry.count++;

  if (entry.count > config.limit) {
    return {
      success: false,
      remaining: 0,
      reset: entry.resetAt,
      response: tooManyResponse(config.limit, entry.resetAt),
    };
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
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src self",
      "script-src self unsafe-eval unsafe-inline", // needed for Next.js
      "style-src self unsafe-inline https://fonts.googleapis.com",
      "font-src self https://fonts.gstatic.com",
      "img-src self data: blob: https://res.cloudinary.com https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
      "connect-src self wss: https://api.cloudinary.com https://exchangeratesapi.io",
      "frame-ancestors none",
    ].join("; ")
  );
  return response;
}
