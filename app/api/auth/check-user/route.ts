import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { badRequest, success, serverError } from "@/lib/middleware";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, "api-general");
    if (!rl.success) return rl.response!;

    const { phone } = await req.json();

    if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return badRequest("Invalid phone number. Use international format: +1234567890");
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { phone } });

    return success({
      message: "User checked successfully",
      isNewUser: !existing,
    });
  } catch (error) {
    console.error("Check user error:", error);
    return serverError();
  }
}
