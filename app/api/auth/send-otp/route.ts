import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createOTP, sendOTPSMS, isSmsConfigured } from "@/lib/auth";
import { badRequest, success, serverError } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "send-otp");
    if (!rl.success) return rl.response!;

    const { phone } = await req.json();

    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return badRequest("Invalid phone number. Use international format: +1234567890");
    }

    // Fail honestly when SMS is not configured — never pretend an OTP was sent.
    if (!isSmsConfigured()) {
      return NextResponse.json(
        {
          message:
            "SMS login is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER in the environment, then try again.",
        },
        { status: 503 }
      );
    }

    const code = await createOTP(phone);
    const sent = await sendOTPSMS(phone, code);

    if (!sent) {
      return NextResponse.json(
        { message: "Failed to send OTP. Please try again." },
        { status: 503 }
      );
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { phone } });

    // The OTP code is NEVER returned to the client.
    return success({
      message: "OTP sent successfully",
      isNewUser: !existing,
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return serverError();
  }
}
