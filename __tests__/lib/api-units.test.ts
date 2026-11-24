/** @jest-environment node */
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { mockPrisma, mockUser, mockAdmin, resetMockPrisma } from "../helpers/prismaMock";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockPrisma } = require("../helpers/prismaMock");
  return { prisma: mockPrisma };
});

import {
  createOTP,
  verifyOTP,
  sendOTPSMS,
  isSmsConfigured,
  generateOTP,
} from "@/lib/auth";
import { signToken, verifyToken } from "@/lib/jwt";
import { uploadImage, getOptimizedImageUrl } from "@/lib/upload";
import { rateLimit, addSecurityHeaders } from "@/lib/ratelimit";
import {
  getAuthUser,
  setAuthCookie,
  clearAuthCookie,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  serverError,
  success,
} from "@/lib/middleware";
import { apiRequest, api } from "@/lib/api";
import { reverseGeocode } from "@/lib/geo";

const PHONE = "+15551234567";
const SECRET = "test-jwt-secret-for-jest-only-0123456789";

function sha(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function reqWithIp(ip: string, path = "http://localhost:3000/api/test"): NextRequest {
  return new NextRequest(path, { headers: { "x-forwarded-for": ip } });
}

describe("lib/jwt", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it("signs and verifies a token round-trip", () => {
    const token = signToken({ userId: "user-1", phone: PHONE, role: "COOK" });
    const payload = verifyToken(token);
    expect(payload).toMatchObject({ userId: "user-1", phone: PHONE, role: "COOK" });
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a forged token", () => {
    expect(verifyToken("aaa.bbb.ccc")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const other = jwt.sign({ userId: "user-1", phone: PHONE, role: "COOK" }, "a-different-secret-that-is-long-enough-123", {
      algorithm: "HS256",
    });
    expect(verifyToken(other)).toBeNull();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ userId: "user-1", phone: PHONE, role: "COOK" }, SECRET, {
      algorithm: "HS256",
      expiresIn: -10,
    });
    expect(verifyToken(expired)).toBeNull();
  });

  it("rejects a token missing required claims", () => {
    const partial = jwt.sign({ userId: "user-1" }, SECRET, { algorithm: "HS256" });
    expect(verifyToken(partial)).toBeNull();
  });

  it("throws when the secret is missing or too short", () => {
    process.env.JWT_SECRET = "short";
    expect(() => signToken({ userId: "u", phone: PHONE, role: "COOK" })).toThrow(/JWT_SECRET/);
    expect(verifyToken("x.y.z")).toBeNull();
    delete process.env.JWT_SECRET;
    expect(() => signToken({ userId: "u", phone: PHONE, role: "COOK" })).toThrow(/JWT_SECRET/);
  });
});

describe("lib/auth OTP", () => {
  beforeEach(() => {
    resetMockPrisma();
    process.env.JWT_SECRET = SECRET;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it("generateOTP returns a 6-digit code", () => {
    expect(generateOTP()).toMatch(/^\d{6}$/);
  });

  it("isSmsConfigured is false without all three Twilio vars", () => {
    expect(isSmsConfigured()).toBe(false);
    process.env.TWILIO_ACCOUNT_SID = "ACx";
    expect(isSmsConfigured()).toBe(false);
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_PHONE_NUMBER = "+15550000000";
    expect(isSmsConfigured()).toBe(true);
  });

  it("createOTP invalidates previous codes and stores only the hash", async () => {
    const code = await createOTP(PHONE);
    expect(code).toMatch(/^\d{6}$/);
    expect(mockPrisma.oTP.updateMany).toHaveBeenCalledWith({
      where: { phone: PHONE, used: false },
      data: { used: true },
    });
    const created = mockPrisma.oTP.create.mock.calls[0][0].data;
    expect(created.phone).toBe(PHONE);
    expect(created.code).toBe(sha(code));
    expect(created.code).not.toBe(code);
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("verifyOTP accepts the correct code once", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue({
      id: "otp-1",
      code: sha("123456"),
      attempts: 0,
    });
    expect(await verifyOTP(PHONE, "123456")).toBe(true);
    expect(mockPrisma.oTP.update).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { used: true },
    });
  });

  it("verifyOTP returns false when no live code exists", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(null);
    expect(await verifyOTP(PHONE, "123456")).toBe(false);
    expect(mockPrisma.oTP.update).not.toHaveBeenCalled();
  });

  it("verifyOTP counts a wrong attempt", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue({ id: "otp-1", code: sha("123456"), attempts: 2 });
    expect(await verifyOTP(PHONE, "000000")).toBe(false);
    expect(mockPrisma.oTP.update).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { attempts: 3 },
    });
  });

  it("verifyOTP invalidates the code after the 5th wrong attempt", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue({ id: "otp-1", code: sha("123456"), attempts: 4 });
    expect(await verifyOTP(PHONE, "000000")).toBe(false);
    expect(mockPrisma.oTP.update).toHaveBeenCalledWith({
      where: { id: "otp-1" },
      data: { attempts: 5, used: true },
    });
  });

  it("sendOTPSMS returns false and sends nothing when unconfigured", async () => {
    expect(await sendOTPSMS(PHONE, "123456")).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sendOTPSMS posts to Twilio when configured", async () => {
    Object.assign(process.env, {
      TWILIO_ACCOUNT_SID: "ACtest",
      TWILIO_AUTH_TOKEN: "tokentest",
      TWILIO_PHONE_NUMBER: "+15550000000",
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    expect(await sendOTPSMS(PHONE, "123456")).toBe(true);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("ACtest");
    expect((init.body as URLSearchParams).get("To")).toBe(PHONE);
    expect((init.body as URLSearchParams).get("Body")).toContain("123456");
  });

  it("sendOTPSMS returns false when Twilio rejects the message", async () => {
    Object.assign(process.env, {
      TWILIO_ACCOUNT_SID: "ACtest",
      TWILIO_AUTH_TOKEN: "tokentest",
      TWILIO_PHONE_NUMBER: "+15550000000",
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await sendOTPSMS(PHONE, "123456")).toBe(false);
  });

  it("sendOTPSMS returns false when the request throws", async () => {
    Object.assign(process.env, {
      TWILIO_ACCOUNT_SID: "ACtest",
      TWILIO_AUTH_TOKEN: "tokentest",
      TWILIO_PHONE_NUMBER: "+15550000000",
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));
    expect(await sendOTPSMS(PHONE, "123456")).toBe(false);
  });
});

describe("lib/upload", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  const jpg = () => new File(["x"], "a.jpg", { type: "image/jpeg" });

  it("rejects non-image files", async () => {
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    await expect(uploadImage(pdf)).rejects.toThrow(/Only JPEG, PNG, WebP or GIF/);
  });

  it("rejects images over 5 MB", async () => {
    const big = new File([new ArrayBuffer(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    await expect(uploadImage(big)).rejects.toThrow(/5 MB or smaller/);
  });

  it("rejects when Cloudinary is not configured", async () => {
    await expect(uploadImage(jpg())).rejects.toThrow(/Cloudinary not configured/);
  });

  it("uploads and returns the secure URL", async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "demo";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/x.jpg" }),
    });
    await expect(uploadImage(jpg())).resolves.toBe(
      "https://res.cloudinary.com/demo/image/upload/x.jpg"
    );
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("demo/image/upload");
    expect((init.body as FormData).get("upload_preset")).toBe("cfe_dishes");
  });

  it("rejects a failed upload", async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "demo";
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(uploadImage(jpg())).rejects.toThrow(/Image upload failed/);
  });

  it("rejects a URL from another cloud", async () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "demo";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: "https://res.cloudinary.com/other/image/upload/x.jpg" }),
    });
    await expect(uploadImage(jpg())).rejects.toThrow(/Image upload failed/);
  });

  it("getOptimizedImageUrl passes through non-Cloudinary URLs", () => {
    expect(getOptimizedImageUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg");
    expect(getOptimizedImageUrl("")).toBe("");
    expect(getOptimizedImageUrl("https://res.cloudinary.com/demo/image/upload/x.jpg")).toContain(
      "/upload/w_400,h_300,c_fill,q_auto,f_auto/"
    );
    expect(
      getOptimizedImageUrl("https://res.cloudinary.com/demo/image/upload/x.jpg", 800, 600)
    ).toContain("w_800,h_600");
  });
});

describe("lib/ratelimit", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("allows requests under the limit and reports remaining", async () => {
    const first = await rateLimit(reqWithIp("10.1.1.1"), "api-general");
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(119);
    const second = await rateLimit(reqWithIp("10.1.1.1"), "api-general");
    expect(second.remaining).toBe(118);
  });

  it("blocks after the send-otp limit and returns a 429 response", async () => {
    const ip = "10.2.2.2";
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(reqWithIp(ip), "send-otp")).success).toBe(true);
    }
    const blocked = await rateLimit(reqWithIp(ip), "send-otp");
    expect(blocked.success).toBe(false);
    expect(blocked.response?.status).toBe(429);
    expect(blocked.response?.headers.get("Retry-After")).toBeDefined();
    expect(blocked.response?.headers.get("X-RateLimit-Limit")).toBe("3");
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    const req = new NextRequest("http://localhost:3000/api/test", {
      headers: { "x-real-ip": "10.3.3.3" },
    });
    const res = await rateLimit(req, "api-general");
    expect(res.success).toBe(true);
  });

  it("addSecurityHeaders sets the security headers", () => {
    const res = addSecurityHeaders(NextResponse.json({ ok: true }));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors none");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
  });
});

describe("lib/middleware", () => {
  beforeEach(() => {
    resetMockPrisma();
    process.env.JWT_SECRET = SECRET;
  });

  function authedReq(user: typeof mockUser, useBearer = false): NextRequest {
    const token = signToken({ userId: user.id, phone: user.phone, role: user.role });
    const headers: Record<string, string> = {};
    if (useBearer) headers.authorization = `Bearer ${token}`;
    else headers.cookie = `cfe_token=${token}`;
    return new NextRequest("http://localhost:3000/api/me", { headers });
  }

  it("getAuthUser resolves the user from the cookie", async () => {
    const user = await getAuthUser(authedReq(mockUser));
    expect(user?.id).toBe("user-1");
  });

  it("getAuthUser resolves the user from a Bearer token", async () => {
    const user = await getAuthUser(authedReq(mockAdmin, true));
    expect(user?.role).toBe("ADMIN");
  });

  it("getAuthUser falls back to the cookie when the Bearer token is bad", async () => {
    const req = authedReq(mockUser);
    req.headers.set("authorization", "Bearer forged.token");
    const user = await getAuthUser(req);
    expect(user?.id).toBe("user-1");
  });

  it("getAuthUser returns null with no credentials", async () => {
    const user = await getAuthUser(new NextRequest("http://localhost:3000/api/me"));
    expect(user).toBeNull();
  });

  it("getAuthUser returns null when the user no longer exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const user = await getAuthUser(authedReq(mockUser));
    expect(user).toBeNull();
  });

  it("setAuthCookie sets an httpOnly cookie and clearAuthCookie expires it", () => {
    const res = setAuthCookie(NextResponse.json({}), "tok123");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("cfe_token=tok123");
    expect(setCookie).toContain("HttpOnly");
    // NextResponse serializes sameSite verbatim ("lax"), so match case-insensitively.
    expect(setCookie).toMatch(/SameSite=lax/i);
    const cleared = clearAuthCookie(NextResponse.json({}));
    expect(cleared.headers.get("set-cookie") ?? "").toMatch(/Max-Age=0/);
  });

  it("response helpers return the right statuses", async () => {
    expect(unauthorized().status).toBe(401);
    expect((await unauthorized().json()).message).toBe("Unauthorized");
    expect(forbidden().status).toBe(403);
    expect((await forbidden("Nope").json()).message).toBe("Nope");
    expect(badRequest("Bad").status).toBe(400);
    expect(notFound().status).toBe(404);
    expect((await notFound("Gone").json()).message).toBe("Gone");
    expect(serverError().status).toBe(500);
    const ok = success({ a: 1 }, 201);
    expect(ok.status).toBe(201);
    expect((await ok.json()).a).toBe(1);
  });
});

describe("lib/api", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it("returns parsed JSON on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ hello: "world" }),
    });
    await expect(apiRequest<{ hello: string }>("/auth/me")).resolves.toEqual({ hello: "world" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/me"),
      expect.objectContaining({ credentials: "same-origin" })
    );
  });

  it("throws the server's error message on failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Nope" }),
    });
    await expect(apiRequest("/auth/me")).rejects.toThrow("Nope");
  });

  it("throws a generic error when the error body is unreadable", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("bad json");
      },
    });
    await expect(apiRequest("/auth/me")).rejects.toThrow("Request failed");
  });

  it("exposes get/post/put/patch/delete helpers", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) });
    await api.get("/x");
    await api.post("/x", { a: 1 });
    await api.put("/x", { a: 1 });
    await api.patch("/x", { a: 1 });
    await api.delete("/x");
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(5);
    expect(calls[0][1]).not.toHaveProperty("method");
    expect(calls[1][1].method).toBe("POST");
    expect(calls[1][1].body).toBe(JSON.stringify({ a: 1 }));
    expect(calls[2][1].method).toBe("PUT");
    expect(calls[3][1].method).toBe("PATCH");
    expect(calls[4][1].method).toBe("DELETE");
  });
});

describe("lib/geo reverseGeocode", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it("returns the city and country", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ address: { city: "Lahore", country: "Pakistan" } }),
    });
    await expect(reverseGeocode(31.5, 74.3)).resolves.toEqual({
      city: "Lahore",
      country: "Pakistan",
    });
  });

  it("falls back to town/village and Unknown", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ address: { town: "Kasur" } }),
    });
    await expect(reverseGeocode(31.1, 74.4)).resolves.toEqual({
      city: "Kasur",
      country: "Unknown",
    });
  });

  it("returns Unknown when the lookup fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("offline"));
    await expect(reverseGeocode(0, 0)).resolves.toEqual({ city: "Unknown", country: "Unknown" });
  });
});
