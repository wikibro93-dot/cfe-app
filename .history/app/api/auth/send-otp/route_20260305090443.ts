import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createOTP, sendOTPSMS } from "@/lib/auth";
import { badRequest, success, serverError } from "@/lib/middleware";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return badRequest("Invalid phone number. Use international format: +1234567890");
    }

    const code = await createOTP(phone);
    const sent = await sendOTPSMS(phone, code);

    if (!sent) {
      return serverError("Failed to send OTP. Please try again.");
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { phone } });

    return success({
      message: "OTP sent successfully",
      isNewUser: !existing,
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return serverError();
  }
}
