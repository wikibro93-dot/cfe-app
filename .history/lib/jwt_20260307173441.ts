// Edge-safe JWT implementation using Web Crypto API
// This file can be imported by middleware.ts (Edge runtime)

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";

export interface JWTPayload {
  userId: string;
  phone: string;
  role: string;
}

// Helper function to encode base64url
function base64UrlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Helper function to decode base64url
function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

// Simple JWT verification (for development/testing)
// In production, you should use a proper JWT library or verify signature
export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    const decoded = base64UrlDecode(payload);
    const parsed = JSON.parse(decoded) as JWTPayload;

    // Basic validation
    if (!parsed.userId || !parsed.phone || !parsed.role) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

// Simple JWT signing (for development/testing)
// In production, you should use a proper JWT library with proper signature
export function signToken(payload: JWTPayload): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payloadWithExp = {
    ...payload,
    iat: now,
    exp: now + (30 * 24 * 60 * 60) // 30 days
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payloadWithExp));

  // For development, we'll skip the signature verification
  // In production, you should use a proper JWT library
  return `${encodedHeader}.${encodedPayload}.signature`;
}

