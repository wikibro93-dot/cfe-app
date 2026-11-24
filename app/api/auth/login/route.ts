import { NextResponse } from "next/server";

/**
 * REMOVED: passwordless phone-only login.
 *
 * This endpoint used to issue a signed-in token for any phone number with
 * no verification at all. It is now permanently disabled. Sign in with the
 * SMS one-time code instead: POST /api/auth/send-otp, then
 * POST /api/auth/verify-otp.
 *
 * The route is kept (returning 410 Gone) so old clients get a clear error
 * instead of a confusing 404.
 */
export async function POST() {
  return NextResponse.json(
    {
      message:
        "Passwordless phone login has been removed. Sign in with the SMS one-time code instead: POST /api/auth/send-otp, then POST /api/auth/verify-otp.",
    },
    { status: 410 }
  );
}
