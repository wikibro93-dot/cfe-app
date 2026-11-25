import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { signToken, verifyToken, type JWTPayload } from "./jwt";

export { signToken, verifyToken, type JWTPayload };

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

/** SHA-256 hash of a 6-digit code. Only the hash is stored in the database. */
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** True when Twilio is configured well enough to send an SMS. */
export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
}

/** Crypto-secure 6-digit code. */
export function generateOTP(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * Create an OTP for a phone number: invalidates previous unused codes,
 * stores only the SHA-256 hash, 10-minute expiry. Returns the plain code
 * so the caller can send it by SMS. The plain code is never stored or
 * returned to the client.
 */
export async function createOTP(phone: string): Promise<string> {
  await prisma.oTP.updateMany({
    where: { phone, used: false },
    data: { used: true },
  });

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.oTP.create({
    data: { phone, code: hashCode(code), expiresAt },
  });

  return code;
}

/**
 * Verify a code: constant-time hash comparison, single-use, 10-minute
 * expiry, and the code is invalidated after OTP_MAX_ATTEMPTS wrong tries.
 */
export async function verifyOTP(phone: string, code: string): Promise<boolean> {
  const otp = await prisma.oTP.findFirst({
    where: {
      phone,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return false;

  const expected = Buffer.from(otp.code, "hex");
  const actual = Buffer.from(hashCode(code), "hex");
  const match =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    const attempts = otp.attempts + 1;
    await prisma.oTP.update({
      where: { id: otp.id },
      data: {
        attempts,
        ...(attempts >= OTP_MAX_ATTEMPTS ? { used: true } : {}),
      },
    });
    return false;
  }

  await prisma.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return true;
}

/**
 * Send the OTP by SMS via Twilio (REST API, no SDK needed). Returns false
 * — and sends nothing — when Twilio is not configured. The code is never
 * logged.
 */
export async function sendOTPSMS(phone: string, code: string): Promise<boolean> {
  if (!isSmsConfigured()) {
    console.error("Twilio credentials not configured — cannot send OTP SMS");
    return false;
  }

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER!;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromPhone,
          To: phone,
          Body: `Your Community Food Exchange OTP is: ${code}. Valid for 10 minutes.`,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error("SMS send error:", error);
    return false;
  }
}
