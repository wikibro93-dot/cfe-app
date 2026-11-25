/** @jest-environment node */
import { mockPrisma, mockUser, mockAdmin, mockSwap, resetMockPrisma } from "../helpers/prismaMock";
import { makeReq, readBody } from "../helpers/request";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockPrisma } = require("../helpers/prismaMock");
  return { prisma: mockPrisma };
});

import { GET as creditsGet, POST as creditsPost } from "@/app/api/credits/route";
import { GET as statsGet } from "@/app/api/admin/stats/route";
import { GET as adminUsersGet, PATCH as adminUsersPatch } from "@/app/api/admin/users/route";
import { GET as chatGet, POST as chatPost } from "@/app/api/chat/[swapId]/route";
import {
  GET as notifGet,
  PUT as notifPut,
  PATCH as notifPatch,
} from "@/app/api/users/notifications/route";

const moderator = { ...mockUser, id: "mod-1", role: "MODERATOR", name: "Mod" };

describe("GET /api/credits", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.creditTransaction.findMany.mockResolvedValue([
      { id: "tx-1", amount: 10, type: "BONUS", description: "Welcome bonus!" },
    ]);
    mockPrisma.creditTransaction.count.mockResolvedValue(1);
  });

  it("returns 401 without auth", async () => {
    const res = await creditsGet(makeReq("/api/credits"));
    expect(res.status).toBe(401);
  });

  it("returns the balance, transactions and pagination", async () => {
    const res = await creditsGet(makeReq("/api/credits?page=2", { user: mockUser }));
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.balance).toBe(25);
    expect(body.transactions).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 2, limit: 20, total: 1 });
    expect(mockPrisma.creditTransaction.findMany.mock.calls[0][0].skip).toBe(20);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.creditTransaction.findMany.mockRejectedValue(new Error("db down"));
    const res = await creditsGet(makeReq("/api/credits", { user: mockUser }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/credits", () => {
  beforeEach(() => resetMockPrisma());

  it("returns 401 without auth", async () => {
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "DONATE", amount: 5 } })
    );
    expect(res.status).toBe(401);
  });

  it("refuses PURCHASE with 503 (no Stripe integration)", async () => {
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "PURCHASE", amount: 100 }, user: mockUser })
    );
    expect(res.status).toBe(503);
    expect((await readBody(res)).message).toMatch(/not available yet/);
  });

  it("rejects an invalid donation amount", async () => {
    for (const amount of [0, -5, "abc", undefined]) {
      const res = await creditsPost(
        makeReq("/api/credits", { method: "POST", body: { type: "DONATE", amount }, user: mockUser })
      );
      expect(res.status).toBe(400);
    }
  });

  it("rejects a donation the user cannot afford", async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...mockUser, credits: 5 }));
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "DONATE", amount: 10 }, user: mockUser })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Insufficient credits");
  });

  it("rejects a donation lost to a concurrent spend", async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...mockUser, credits: 100 }));
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "DONATE", amount: 10 }, user: mockUser })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Insufficient credits");
  });

  it("donates and thanks the donor", async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...mockUser, credits: 25, badges: [] }));
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "DONATE", amount: 10 }, user: mockUser })
    );
    expect(res.status).toBe(200);
    expect((await readBody(res)).message).toMatch(/Thank you/);
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "DONATED", amount: -10, balanceBefore: 25, balanceAfter: 15 }),
      })
    );
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "CREDITS_DONATED" }) })
    );
    // Balance below 50: no donor badge.
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("awards the top_donor badge for a 50+ balance", async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...mockUser, credits: 60, badges: [] }));
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "DONATE", amount: 10 }, user: mockUser })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: { badges: { push: "top_donor" } },
      })
    );
  });

  it("does not re-award the badge to an existing top donor", async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({
      ...mockUser,
      credits: 60,
      badges: ["top_donor"],
    }));
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "DONATE", amount: 10 }, user: mockUser })
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown credit type", async () => {
    const res = await creditsPost(
      makeReq("/api/credits", { method: "POST", body: { type: "STEAL", amount: 5 }, user: mockUser })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Invalid credit type");
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.creditTransaction.findMany.mockRejectedValue(new Error("db down"));
    const res = await creditsGet(makeReq("/api/credits", { user: mockUser }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/admin/stats", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.user.count.mockResolvedValue(4);
    mockPrisma.dish.count.mockResolvedValue(10);
    mockPrisma.swap.count.mockResolvedValue(4);
    mockPrisma.creditTransaction.groupBy.mockResolvedValue([
      { type: "BONUS", _sum: { amount: 40 }, _count: 4 },
    ]);
  });

  it("returns 401 without auth", async () => {
    const res = await statsGet(makeReq("/api/admin/stats"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a regular user", async () => {
    const res = await statsGet(makeReq("/api/admin/stats", { user: mockUser }));
    expect(res.status).toBe(403);
  });

  it("returns stats for an admin, with a computed success rate", async () => {
    mockPrisma.swap.count.mockImplementation(async (args: any) =>
      args?.where?.status === "COMPLETED" ? 2 : 4
    );
    mockPrisma.dish.count.mockImplementation(async (args: any) =>
      args?.where?.status === "AVAILABLE" ? 6 : 10
    );
    const res = await statsGet(makeReq("/api/admin/stats", { user: mockAdmin }));
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.stats.totalUsers).toBe(4);
    expect(body.stats.totalDishes).toBe(10);
    expect(body.stats.successRate).toBe(50);
    expect(body.stats.activeDishes).toBe(6);
    expect(body.creditStats).toHaveLength(1);
  });

  it("reports a 0% success rate with no swaps", async () => {
    mockPrisma.swap.count.mockResolvedValue(0);
    const res = await statsGet(makeReq("/api/admin/stats", { user: moderator }));
    expect(res.status).toBe(200);
    expect((await readBody(res)).stats.successRate).toBe(0);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.user.count.mockRejectedValue(new Error("db down"));
    const res = await statsGet(makeReq("/api/admin/stats", { user: mockAdmin }));
    expect(res.status).toBe(500);
  });
});

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.user.findMany.mockResolvedValue([{ ...mockUser }]);
    mockPrisma.user.count.mockResolvedValue(1);
  });

  it("returns 401 without auth", async () => {
    const res = await adminUsersGet(makeReq("/api/admin/users"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a regular user", async () => {
    const res = await adminUsersGet(makeReq("/api/admin/users", { user: mockUser }));
    expect(res.status).toBe(403);
  });

  it("lists users for a moderator, with search and role filters", async () => {
    const res = await adminUsersGet(
      makeReq("/api/admin/users?search=Fatima&role=COOK&page=2", { user: moderator })
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.users).toHaveLength(1);
    expect(body.pagination.page).toBe(2);
    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where.role).toBe("COOK");
    expect(where.OR).toHaveLength(2);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("db down"));
    const res = await adminUsersGet(makeReq("/api/admin/users", { user: mockAdmin }));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/users", () => {
  // getAuthUser looks up the caller by id AND the handler looks up the
  // target by id, so the mock must tell them apart.
  function setTarget(target: { id: string; role: string; credits: number } | null) {
    mockPrisma.user.findUnique.mockImplementation(async (args: any) => {
      const id = args?.where?.id as string | undefined;
      if (id === "admin-1") return { ...mockAdmin };
      if (id === "mod-1") return { ...moderator };
      if (id === "user-2") return target;
      return null;
    });
  }

  beforeEach(() => {
    resetMockPrisma();
    setTarget({ id: "user-2", role: "COOK", credits: 10 });
    mockPrisma.user.count.mockResolvedValue(2);
  });

  function patch(body: unknown, user: typeof mockUser = mockAdmin) {
    return adminUsersPatch(makeReq("/api/admin/users", { method: "PATCH", body, user }));
  }

  it("returns 401 without auth", async () => {
    const res = await adminUsersPatch(
      makeReq("/api/admin/users", { method: "PATCH", body: { userId: "user-2", action: "verifyCook" } })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a moderator (admin only)", async () => {
    const res = await patch({ userId: "user-2", action: "verifyCook" }, moderator);
    expect(res.status).toBe(403);
  });

  it("rejects a missing userId or action", async () => {
    const res = await patch({ action: "verifyCook" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown target user", async () => {
    setTarget(null);
    const res = await patch({ userId: "ghost", action: "verifyCook" });
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("User not found");
  });

  it("rejects an invalid role", async () => {
    const res = await patch({ userId: "user-2", action: "setRole", value: "SUPERUSER" });
    expect(res.status).toBe(400);
  });

  it("refuses an admin demoting themselves", async () => {
    const res = await patch({ userId: "admin-1", action: "setRole", value: "COOK" });
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/own admin role/);
  });

  it("refuses to remove the last admin", async () => {
    setTarget({ id: "user-2", role: "ADMIN", credits: 10 });
    mockPrisma.user.count.mockResolvedValue(1);
    const res = await patch({ userId: "user-2", action: "setRole", value: "COOK" });
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/last admin/);
  });

  it("changes a user's role", async () => {
    const res = await patch({ userId: "user-2", action: "setRole", value: "MODERATOR" });
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-2" }, data: { role: "MODERATOR" } })
    );
  });

  it("verifies a cook", async () => {
    const res = await patch({ userId: "user-2", action: "verifyCook" });
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isVerifiedCook: true } })
    );
  });

  it("rejects a non-numeric credit amount", async () => {
    const res = await patch({ userId: "user-2", action: "addCredits", value: "lots" });
    expect(res.status).toBe(400);
  });

  it("grants credits with a ledger entry", async () => {
    const res = await patch({ userId: "user-2", action: "addCredits", value: "15" });
    expect(res.status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "BONUS", amount: 15, balanceBefore: 10, balanceAfter: 25 }),
      })
    );
  });

  it("rejects an unknown action", async () => {
    const res = await patch({ userId: "user-2", action: "ban" });
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Invalid action");
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("db down"));
    const res = await patch({ userId: "user-2", action: "verifyCook" });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/chat/[swapId]", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap });
    mockPrisma.chatMessage.findMany.mockResolvedValue([
      { id: "msg-1", text: "Hello", sender: { id: "user-1", name: "Test User", avatar: null } },
    ]);
  });
  const params = { params: Promise.resolve({ swapId: "swap-1" }) };

  it("returns 401 without auth", async () => {
    const res = await chatGet(makeReq("/api/chat/swap-1"), params);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an unknown swap", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue(null);
    const res = await chatGet(makeReq("/api/chat/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(400);
  });

  it("returns 403 for a third party", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, buyerId: "u-9", cookId: "c-9" });
    const res = await chatGet(makeReq("/api/chat/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(403);
  });

  it("returns the chat history", async () => {
    const res = await chatGet(makeReq("/api/chat/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body).toHaveLength(1);
    expect(body[0].text).toBe("Hello");
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.chatMessage.findMany.mockRejectedValue(new Error("db down"));
    const res = await chatGet(makeReq("/api/chat/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/chat/[swapId]", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap });
  });
  const params = { params: Promise.resolve({ swapId: "swap-1" }) };

  function post(body: unknown, user: typeof mockUser = mockUser) {
    return chatPost(makeReq("/api/chat/swap-1", { method: "POST", body, user }), params);
  }

  it("returns 401 without auth", async () => {
    const res = await chatPost(
      makeReq("/api/chat/swap-1", { method: "POST", body: { text: "Hi" } }),
      params
    );
    expect(res.status).toBe(401);
  });

  it("rejects an empty message", async () => {
    const res = await post({ text: "   " });
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/cannot be empty/);
  });

  it("rejects a message over 500 characters", async () => {
    const res = await post({ text: "x".repeat(501) });
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/too long/);
  });

  it("returns 400 for an unknown swap", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue(null);
    const res = await post({ text: "Hi" });
    expect(res.status).toBe(400);
  });

  it("returns 403 for a third party", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, buyerId: "u-9", cookId: "c-9" });
    const res = await post({ text: "Hi" });
    expect(res.status).toBe(403);
  });

  it("sends the message", async () => {
    const res = await post({ text: "  See you at 6!  " });
    expect(res.status).toBe(201);
    const body = await readBody(res);
    expect(body.text).toBe("See you at 6!");
    expect(body.senderName).toBe("Test User");
    expect(mockPrisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ swapId: "swap-1", senderId: "user-1" }) })
    );
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.chatMessage.create.mockRejectedValue(new Error("db down"));
    const res = await post({ text: "Hi" });
    expect(res.status).toBe(500);
  });
});

describe("GET /api/users/notifications", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: "n1", read: false },
      { id: "n2", read: true },
      { id: "n3", read: false },
    ]);
  });

  it("returns 401 without auth", async () => {
    const res = await notifGet(makeReq("/api/users/notifications"));
    expect(res.status).toBe(401);
  });

  it("returns notifications with the unread count", async () => {
    const res = await notifGet(makeReq("/api/users/notifications", { user: mockUser }));
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.notifications).toHaveLength(3);
    expect(body.unreadCount).toBe(2);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.notification.findMany.mockRejectedValue(new Error("db down"));
    const res = await notifGet(makeReq("/api/users/notifications", { user: mockUser }));
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/users/notifications", () => {
  beforeEach(() => resetMockPrisma());

  it("returns 401 without auth", async () => {
    const res = await notifPut(makeReq("/api/users/notifications", { method: "PUT" }));
    expect(res.status).toBe(401);
  });

  it("marks all notifications as read", async () => {
    const res = await notifPut(makeReq("/api/users/notifications", { method: "PUT", user: mockUser }));
    expect(res.status).toBe(200);
    expect((await readBody(res)).message).toMatch(/marked as read/);
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", read: false } })
    );
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.notification.updateMany.mockRejectedValue(new Error("db down"));
    const res = await notifPut(makeReq("/api/users/notifications", { method: "PUT", user: mockUser }));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/users/notifications", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.notification.findUnique.mockResolvedValue({
      id: "n1",
      userId: "user-1",
      read: false,
    });
  });

  it("returns 401 without auth", async () => {
    const res = await notifPatch(makeReq("/api/users/notifications?id=n1", { method: "PATCH" }));
    expect(res.status).toBe(401);
  });

  it("requires a notification id", async () => {
    const res = await notifPatch(
      makeReq("/api/users/notifications", { method: "PATCH", user: mockUser })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown notification", async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null);
    const res = await notifPatch(
      makeReq("/api/users/notifications?id=n1", { method: "PATCH", user: mockUser })
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 for someone else's notification", async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({ id: "n1", userId: "user-9", read: false });
    const res = await notifPatch(
      makeReq("/api/users/notifications?id=n1", { method: "PATCH", user: mockUser })
    );
    expect(res.status).toBe(403);
  });

  it("marks one notification as read", async () => {
    const res = await notifPatch(
      makeReq("/api/users/notifications?id=n1", { method: "PATCH", user: mockUser })
    );
    expect(res.status).toBe(200);
    expect((await readBody(res)).message).toMatch(/marked as read/);
    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "n1" }, data: { read: true } })
    );
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.notification.findUnique.mockRejectedValue(new Error("db down"));
    const res = await notifPatch(
      makeReq("/api/users/notifications?id=n1", { method: "PATCH", user: mockUser })
    );
    expect(res.status).toBe(500);
  });
});
