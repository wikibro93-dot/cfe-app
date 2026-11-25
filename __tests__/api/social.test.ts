/** @jest-environment node */
import { mockPrisma, mockUser, resetMockPrisma } from "../helpers/prismaMock";
import { makeReq, readBody } from "../helpers/request";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockPrisma } = require("../helpers/prismaMock");
  return { prisma: mockPrisma };
});

const mockDecoded = {
  uid: "firebase-uid-1",
  email: "Test@Example.com",
  name: "Test User",
  picture: "https://lh3.googleusercontent.com/photo.jpg",
  firebase: {
    sign_in_provider: "google.com",
    auth_time: "2026-11-25T00:00:00Z",
  },
};

jest.mock("@/lib/firebase-admin", () => ({
  isFirebaseAdminConfigured: jest.fn(() => true),
  verifyFirebaseIdToken: jest.fn(async () => mockDecoded),
}));

import { POST as social } from "@/app/api/auth/social/route";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

describe("POST /api/auth/social", () => {
  beforeEach(() => {
    resetMockPrisma();
    jest.clearAllMocks();
  });

  it("rejects a missing token", async () => {
    const res = await social(makeReq("/api/auth/social", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/token is required/);
    expect(verifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it("rejects an unverifiable token", async () => {
    (verifyFirebaseIdToken as jest.Mock).mockResolvedValueOnce(null);
    const res = await social(
      makeReq("/api/auth/social", { method: "POST", body: { idToken: "bad-token" } })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/Invalid or expired/);
  });

  it("rejects an unsupported provider", async () => {
    (verifyFirebaseIdToken as jest.Mock).mockResolvedValueOnce({
      ...mockDecoded,
      firebase: { sign_in_provider: "phone" },
    });
    const res = await social(
      makeReq("/api/auth/social", { method: "POST", body: { idToken: "tok" } })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/Unsupported sign-in provider/);
  });

  it("signs in an existing user by Firebase UID", async () => {
    const res = await social(
      makeReq("/api/auth/social", { method: "POST", body: { idToken: "tok" } })
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.user.id).toBe(mockUser.id);
    expect(body.isNewUser).toBe(false);
    expect(res.headers.get("set-cookie")).toMatch(/cfe_token=/);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("links by verified email when the UID is new", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null); // no UID match
    const res = await social(
      makeReq("/api/auth/social", { method: "POST", body: { idToken: "tok" } })
    );
    expect(res.status).toBe(200);
    expect((await readBody(res)).isNewUser).toBe(false);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mockUser.id } })
    );
    const updateData = (mockPrisma.user.update as jest.Mock).mock.calls[0][0].data;
    expect(updateData.firebaseUid).toBe("firebase-uid-1");
    expect(updateData.authProvider).toBe("GOOGLE");
  });

  it("creates a new user with the welcome bonus", async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // no UID match
      .mockResolvedValueOnce(null); // no email match
    const res = await social(
      makeReq("/api/auth/social", { method: "POST", body: { idToken: "tok" } })
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.isNewUser).toBe(true);
    expect(body.user.credits).toBe(10);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 10, type: "BONUS" }),
      })
    );
  });

  it("rate limits after 5 sign-ins from one IP", async () => {
    const ip = "10.99.98.97";
    for (let i = 0; i < 5; i++) {
      const res = await social(
        makeReq("/api/auth/social", { method: "POST", body: { idToken: "tok" }, ip })
      );
      expect(res.status).toBe(200);
    }
    const blocked = await social(
      makeReq("/api/auth/social", { method: "POST", body: { idToken: "tok" }, ip })
    );
    expect(blocked.status).toBe(429);
  });
});
