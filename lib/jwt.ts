import jwt from "jsonwebtoken";

export interface JWTPayload {
  userId: string;
  // Phone is optional: social sign-in (Google/Facebook) has no phone
  // number. Only userId + role are required to trust a token.
  phone?: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Token lifetime: 7 days (the maximum we allow). A shorter expiry with
 * refresh tokens is a follow-up; 7 days is a deliberate, bounded choice.
 */
export const TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Returns the signing secret, or throws. Auth must fail loudly when the
 * secret is missing — never fall back to a default or an unsigned token.
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is not set (or is shorter than 32 characters). " +
        "Generate one with `openssl rand -base64 32` and set it in the environment."
    );
  }
  return secret;
}

/** Sign a token with HMAC-SHA256. Throws if JWT_SECRET is not configured. */
export function signToken(payload: JWTPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      ...(payload.phone ? { phone: payload.phone } : {}),
      role: payload.role,
    },
    getSecret(),
    { algorithm: "HS256", expiresIn: TOKEN_MAX_AGE_SECONDS }
  );
}

/**
 * Verify a token: checks the HMAC signature AND the expiry. Returns null
 * for any invalid, expired, or forged token. Never returns a payload from
 * an unverified token.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), {
      algorithms: ["HS256"],
    }) as JWTPayload;
    if (!decoded.userId || !decoded.role) return null;
    return decoded;
  } catch {
    return null;
  }
}
