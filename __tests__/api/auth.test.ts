/** @jest-environment node */
import { createHash } from "node:crypto";
import { mockPrisma, mockUser, mockAdmin, resetMockPrisma } from "../helpers/prismaMock";
import { makeReq, readBody } from "../helpers/request";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockPrisma } = require("../helpers/prismaMock");
  return { prisma: mockPrisma };
});

import { POST as sendOtp } from "@/app/api/auth/send-otp/route";
import { POST as verifyOtp } from "@/app/api/auth/verify-otp/route";
import { GET as meGet, PUT as mePut } from "@/app/api/auth/me/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as checkUser } from "@/app/api/auth/check-user/route";

const PHONE = "+15551234567";
const TWILIO_ENV = {
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_AUTH_TOKEN: "tokentest",
  TWILIO_PHONE_NUMBER: "+15550000000",
};

function sha(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

describe("POST /api/auth/send-otp", () => {
  beforeEach(() => {
    resetMockPrisma();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    global.fetch = jest.fn();
  });
  afterEach(() => jest.restoreAllMocks());

  it("rejects a missing phone number", async () => {
    const res = await sendOtp(makeReq("/api/auth/send-otp", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/Invalid phone number/);
  });

  it("rejects a phone number in the wrong format", async () => {
    const res = await sendOtp(
      makeReq("/api/auth/send-otp", { method: "POST", body: { phone: "12345" } })
    );
    expect(res.status).toBe(400);
  });

  it("returns 503 when Twilio is not configured", async () => {
    const res = await sendOtp(
      makeReq("/api/auth/send-otp", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(503);
    expect((await readBody(res)).message).toMatch(/not configured/);
    expect(mockPrisma.oTP.create).not.toHaveBeenCalled();
  });

  it("sends an OTP to an existing user", async () => {
    Object.assign(process.env, TWILIO_ENV);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });

    const res = await sendOtp(
      makeReq("/api/auth/send-otp", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.message).toMatch(/OTP sent/);
    expect(body.isNewUser).toBe(false);
    expect(mockPrisma.oTP.updateMany).toHaveBeenCalled();
    expect(mockPrisma.oTP.create).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.twilio.com"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reports a new user when the phone is unknown", async () => {
    Object.assign(process.env, TWILIO_ENV);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await sendOtp(
      makeReq("/api/auth/send-otp", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(200);
    expect((await readBody(res)).isNewUser).toBe(true);
  });

  it("returns 503 when Twilio rejects the SMS", async () => {
    Object.assign(process.env, TWILIO_ENV);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    const res = await sendOtp(
      makeReq("/api/auth/send-otp", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(503);
    expect((await readBody(res)).message).toMatch(/Failed to send OTP/);
  });

  it("rate limits after 3 OTP requests from one IP", async () => {
    Object.assign(process.env, TWILIO_ENV);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const ip = "10.99.99.99";
    for (let i = 0; i < 3; i++) {
      const res = await sendOtp(
        makeReq("/api/auth/send-otp", { method: "POST", body: { phone: PHONE }, ip })
      );
      expect(res.status).toBe(200);
    }
    const blocked = await sendOtp(
      makeReq("/api/auth/send-otp", { method: "POST", body: { phone: PHONE }, ip })
    );
    expect(blocked.status).toBe(429);
  });

  it("returns 500 when the database fails", async () => {
    Object.assign(process.env, TWILIO_ENV);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    mockPrisma.oTP.updateMany.mockRejectedValue(new Error("db down"));

    const res = await sendOtp(
      makeReq("/api/auth/send-otp", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /api/auth/verify-otp", () => {
  beforeEach(() => {
    resetMockPrisma();
    global.fetch = jest.fn();
  });

  function validOtpRow() {
    return {
      id: "otp-1",
      phone: PHONE,
      code: sha("123456"),
      expiresAt: new Date(Date.now() + 600_000),
      used: false,
      attempts: 0,
    };
  }

  it("rejects missing phone or code", async () => {
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/required/);
  });

  it("rejects a code that is not 6 digits", async () => {
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", { method: "POST", body: { phone: PHONE, code: "12345" } })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/6 digits/);
  });

  it("rejects a wrong or expired OTP", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(null);
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", {
        method: "POST",
        body: { phone: PHONE, code: "123456", name: "Test User" },
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/Invalid or expired OTP/);
  });

  it("rejects a wrong code and records the attempt", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(validOtpRow());
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", {
        method: "POST",
        body: { phone: PHONE, code: "000000", name: "Test User" },
      })
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.oTP.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "otp-1" } })
    );
  });

  it("requires a name for a new user", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(validOtpRow());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", { method: "POST", body: { phone: PHONE, code: "123456" } })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/Name is required/);
  });

  it("rejects a new-user name over 100 characters", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(validOtpRow());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", {
        method: "POST",
        body: { phone: PHONE, code: "123456", name: "x".repeat(101) },
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates a new user with the 10-credit welcome bonus and sets the cookie", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(validOtpRow());
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.notification.count.mockResolvedValue(2);

    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", {
        method: "POST",
        body: { phone: PHONE, code: "123456", name: "  New User ", language: "xx", currency: "eur" },
      })
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.user.name).toBe("New User");
    expect(body.user.credits).toBe(10);
    expect(body.unreadCount).toBe(2);
    // Invalid language/currency fall back to en/USD.
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("cfe_token=");
    expect(cookie).toContain("HttpOnly");
  });

  it("signs in an existing user and updates preferences", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(validOtpRow());
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });

    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", {
        method: "POST",
        body: { phone: PHONE, code: "123456", language: "ur", currency: "PKR" },
      })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { language: "ur", currency: "PKR" },
      })
    );
    expect((res.headers.get("set-cookie") ?? "")).toContain("cfe_token=");
  });

  it("does not update an existing user when no preferences are given", async () => {
    mockPrisma.oTP.findFirst.mockResolvedValue(validOtpRow());
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });

    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", { method: "POST", body: { phone: PHONE, code: "123456" } })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.oTP.findFirst.mockRejectedValue(new Error("db down"));
    const res = await verifyOtp(
      makeReq("/api/auth/verify-otp", {
        method: "POST",
        body: { phone: PHONE, code: "123456", name: "Test User" },
      })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => resetMockPrisma());

  it("returns 401 without auth", async () => {
    const res = await meGet(makeReq("/api/auth/me"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for a forged token", async () => {
    const res = await meGet(makeReq("/api/auth/me", { token: "forged.token.here" }));
    expect(res.status).toBe(401);
  });

  it("returns the signed-in user with the unread count", async () => {
    mockPrisma.notification.count.mockResolvedValue(3);
    const res = await meGet(makeReq("/api/auth/me", { user: mockUser }));
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.id).toBe("user-1");
    expect(body.name).toBe("Test User");
    expect(body.unreadCount).toBe(3);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.notification.count.mockRejectedValue(new Error("db down"));
    const res = await meGet(makeReq("/api/auth/me", { user: mockUser }));
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/auth/me", () => {
  beforeEach(() => resetMockPrisma());

  const valid = {
    name: "New Name",
    bio: "Hello",
    avatar: "https://res.cloudinary.com/demo/image/upload/x.jpg",
    latitude: 40.7,
    longitude: -74,
    city: "Lahore",
    country: "Pakistan",
    language: "ur",
    currency: "PKR",
  };

  it("returns 401 without auth", async () => {
    const res = await mePut(makeReq("/api/auth/me", { method: "PUT", body: valid }));
    expect(res.status).toBe(401);
  });

  it.each([
    ["empty name", { name: "" }],
    ["name over 100 chars", { name: "x".repeat(101) }],
    ["bio over 500 chars", { bio: "x".repeat(501) }],
    ["non-Cloudinary avatar", { avatar: "https://example.com/a.jpg" }],
    ["latitude out of range", { latitude: 200 }],
    ["longitude out of range", { longitude: 200 }],
    ["city over 100 chars", { city: "x".repeat(101) }],
    ["country over 100 chars", { country: "x".repeat(101) }],
    ["invalid language", { language: "xx" }],
    ["invalid currency", { currency: "usd" }],
  ])("rejects %s", async (_label, patch) => {
    const res = await mePut(
      makeReq("/api/auth/me", { method: "PUT", body: { ...valid, ...patch }, user: mockUser })
    );
    expect(res.status).toBe(400);
  });

  it("updates the profile and trims the name", async () => {
    const res = await mePut(
      makeReq("/api/auth/me", {
        method: "PUT",
        body: { ...valid, name: "  New Name  " },
        user: mockUser,
      })
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.message).toBe("Profile updated");
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ name: "New Name", city: "Lahore" }),
      })
    );
  });

  it("accepts null bio, avatar and city", async () => {
    const res = await mePut(
      makeReq("/api/auth/me", {
        method: "PUT",
        body: { bio: null, avatar: null, city: null, country: null, language: null, currency: null },
        user: mockUser,
      })
    );
    expect(res.status).toBe(200);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("db down"));
    const res = await mePut(
      makeReq("/api/auth/me", { method: "PUT", body: valid, user: mockUser })
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /api/auth/login (removed)", () => {
  it("returns 410 Gone", async () => {
    const res = await login();
    expect(res.status).toBe(410);
    expect((await readBody(res)).message).toMatch(/removed/);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the auth cookie", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    expect((await readBody(res)).message).toBe("Logged out");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("cfe_token=");
    expect(cookie).toMatch(/Max-Age=0/);
  });
});

describe("POST /api/auth/check-user", () => {
  beforeEach(() => resetMockPrisma());

  it("rejects an invalid phone number", async () => {
    const res = await checkUser(
      makeReq("/api/auth/check-user", { method: "POST", body: { phone: "nope" } })
    );
    expect(res.status).toBe(400);
  });

  it("reports a new user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await checkUser(
      makeReq("/api/auth/check-user", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(200);
    expect((await readBody(res)).isNewUser).toBe(true);
  });

  it("reports an existing user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser });
    const res = await checkUser(
      makeReq("/api/auth/check-user", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(200);
    expect((await readBody(res)).isNewUser).toBe(false);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));
    const res = await checkUser(
      makeReq("/api/auth/check-user", { method: "POST", body: { phone: PHONE } })
    );
    expect(res.status).toBe(500);
  });
});

describe("admin auth user", () => {
  it("signs an admin token the same way", async () => {
    resetMockPrisma();
    mockPrisma.notification.count.mockResolvedValue(0);
    const res = await meGet(makeReq("/api/auth/me", { user: mockAdmin }));
    expect(res.status).toBe(200);
    expect((await readBody(res)).role).toBe("ADMIN");
  });
});
