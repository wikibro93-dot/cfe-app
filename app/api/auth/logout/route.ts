import { clearAuthCookie, success } from "@/lib/middleware";

/** POST /api/auth/logout — clears the httpOnly auth cookie. */
export async function POST() {
  return clearAuthCookie(success({ message: "Logged out" }));
}
