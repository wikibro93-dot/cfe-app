/** @jest-environment node */
import { mockPrisma, mockUser, mockAdmin, mockDish, mockSwap, resetMockPrisma } from "../helpers/prismaMock";
import { makeReq, readBody } from "../helpers/request";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockPrisma } = require("../helpers/prismaMock");
  return { prisma: mockPrisma };
});

import { GET as listGet, POST as createPost } from "@/app/api/swaps/route";
import { GET as oneGet, PATCH as onePatch } from "@/app/api/swaps/[id]/route";

describe("GET /api/swaps", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.swap.findMany.mockResolvedValue([{ ...mockSwap }]);
    mockPrisma.swap.count.mockResolvedValue(1);
  });

  it("returns 401 without auth", async () => {
    const res = await listGet(makeReq("/api/swaps"));
    expect(res.status).toBe(401);
  });

  it("lists all swaps for the user by default", async () => {
    const res = await listGet(makeReq("/api/swaps", { user: mockUser }));
    expect(res.status).toBe(200);
    expect((await readBody(res)).swaps).toHaveLength(1);
    expect(mockPrisma.swap.findMany.mock.calls[0][0].where.OR).toEqual([
      { buyerId: "user-1" },
      { cookId: "user-1" },
    ]);
  });

  it("filters by buyer role", async () => {
    await listGet(makeReq("/api/swaps?role=buyer", { user: mockUser }));
    expect(mockPrisma.swap.findMany.mock.calls[0][0].where).toEqual({ buyerId: "user-1" });
  });

  it("filters by cook role and status", async () => {
    await listGet(makeReq("/api/swaps?role=cook&status=PENDING&page=2", { user: mockUser }));
    const call = mockPrisma.swap.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ cookId: "user-1", status: "PENDING" });
    expect(call.skip).toBe(20);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.swap.findMany.mockRejectedValue(new Error("db down"));
    const res = await listGet(makeReq("/api/swaps", { user: mockUser }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/swaps", () => {
  const mockCook = { id: "cook-1", name: "Fatima" };

  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cook: { ...mockCook } });
    mockPrisma.swap.findFirst.mockResolvedValue(null);
  });

  it("returns 401 without auth", async () => {
    const res = await createPost(
      makeReq("/api/swaps", { method: "POST", body: { dishId: "dish-1", type: "FREE" } })
    );
    expect(res.status).toBe(401);
  });

  it("rejects a missing dishId or type", async () => {
    const res = await createPost(
      makeReq("/api/swaps", { method: "POST", body: { dishId: "dish-1" }, user: mockUser })
    );
    expect(res.status).toBe(400);
  });

  it("rejects MONEY swaps", async () => {
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "MONEY" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/MONEY swaps are not supported/);
  });

  it("rejects a message over 500 characters", async () => {
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE", message: "x".repeat(501) },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unknown dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue(null);
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Dish not found");
  });

  it("rejects a dish that is not available", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, status: "RESERVED", cook: mockCook });
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Dish is not available");
  });

  it("rejects swapping your own dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "user-1", cook: mockUser });
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/own dish/);
  });

  it("rejects a second pending swap for the same dish", async () => {
    mockPrisma.swap.findFirst.mockResolvedValue({ ...mockSwap });
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/already have a pending swap/);
  });

  it("rejects DIRECT for a dish that is not swappable", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, isSwappable: false, cook: mockCook });
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "DIRECT" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/not available for direct swap/);
  });

  it("rejects FREE for a dish that is not free", async () => {
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/not free/);
  });

  it("rejects CREDITS for a free dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, isFree: true, cook: mockCook });
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "CREDITS" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/free — request it as a FREE swap/);
  });

  it("rejects CREDITS when the buyer cannot afford the dish", async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...mockUser, credits: 2 }));
    // (getAuthUser and the in-transaction balance check both read this mock.)
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "CREDITS" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/Insufficient credits/);
  });

  it("creates a CREDITS swap and reserves the dish", async () => {
    mockPrisma.user.findUnique.mockImplementation(async () => ({ ...mockUser, credits: 25 }));
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "CREDITS", message: "Hi!" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(201);
    const body = await readBody(res);
    expect(body.type).toBe("CREDITS");
    expect(body.creditAmount).toBe(10);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "SWAP_REQUEST" }) })
    );
  });

  it("creates a FREE swap without touching credits", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, isFree: true, priceCredits: 0, cook: mockCook });
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(201);
    expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
  });

  it("creates a DIRECT swap", async () => {
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "DIRECT" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(201);
  });

  it("reports the dish as unavailable when the reservation loses the race", async () => {
    mockPrisma.dish.updateMany.mockResolvedValue({ count: 0 });
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "DIRECT" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Dish is not available");
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.dish.findUnique.mockRejectedValue(new Error("db down"));
    const res = await createPost(
      makeReq("/api/swaps", {
        method: "POST",
        body: { dishId: "dish-1", type: "FREE" },
        user: mockUser,
      })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/swaps/[id]", () => {
  beforeEach(() => resetMockPrisma());
  const params = { params: Promise.resolve({ id: "swap-1" }) };

  it("returns 401 without auth", async () => {
    const res = await oneGet(makeReq("/api/swaps/swap-1"), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown swap", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue(null);
    const res = await oneGet(makeReq("/api/swaps/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(404);
  });

  it("returns 403 for a third party", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, buyerId: "u-9", cookId: "c-9" });
    const res = await oneGet(makeReq("/api/swaps/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(403);
  });

  it("returns the swap to the buyer", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap });
    const res = await oneGet(makeReq("/api/swaps/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(200);
    expect((await readBody(res)).id).toBe("swap-1");
  });

  it("returns the swap to an admin", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, buyerId: "u-9", cookId: "c-9" });
    const res = await oneGet(makeReq("/api/swaps/swap-1", { user: mockAdmin }), params);
    expect(res.status).toBe(200);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.swap.findUnique.mockRejectedValue(new Error("db down"));
    const res = await oneGet(makeReq("/api/swaps/swap-1", { user: mockUser }), params);
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/swaps/[id]", () => {
  beforeEach(() => resetMockPrisma());
  const params = { params: Promise.resolve({ id: "swap-1" }) };

  function patch(body: unknown, user: typeof mockUser = mockUser) {
    return onePatch(makeReq("/api/swaps/swap-1", { method: "PATCH", body, user }), params);
  }

  it("returns 401 without auth", async () => {
    const res = await onePatch(
      makeReq("/api/swaps/swap-1", { method: "PATCH", body: { action: "confirm" } }),
      params
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown swap", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue(null);
    const res = await patch({ action: "confirm" });
    expect(res.status).toBe(404);
  });

  it("rejects an unknown action", async () => {
    mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap });
    const res = await patch({ action: "explode" });
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toBe("Invalid action");
  });

  describe("confirm", () => {
    it("returns 403 when the buyer tries to confirm", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap });
      const res = await patch({ action: "confirm" });
      expect(res.status).toBe(403);
    });

    it("rejects confirming a swap that is not pending", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "CONFIRMED" });
      const res = await patch({ action: "confirm" }, { ...mockUser, id: "cook-1" });
      expect(res.status).toBe(400);
    });

    it("confirms the swap and notifies the buyer", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap });
      const res = await patch({ action: "confirm" }, { ...mockUser, id: "cook-1" });
      expect(res.status).toBe(200);
      expect((await readBody(res)).message).toBe("Swap confirmed");
      expect(mockPrisma.swap.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "CONFIRMED" }) })
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: "SWAP_CONFIRMED" }) })
      );
    });
  });

  describe("pickup", () => {
    it("returns 403 for a third party", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, buyerId: "u-9", cookId: "c-9" });
      const res = await patch({ action: "pickup" });
      expect(res.status).toBe(403);
    });

    it("requires the swap to be confirmed first", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "PENDING" });
      const res = await patch({ action: "pickup" });
      expect(res.status).toBe(400);
      expect((await readBody(res)).message).toMatch(/confirmed first/);
    });

    it("confirms pickup and pays the cook", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "CONFIRMED" });
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where?.id === "cook-1" ? { credits: 40 } : { ...mockUser }
      );
      const res = await patch({ action: "pickup" });
      expect(res.status).toBe(200);
      expect((await readBody(res)).message).toBe("Pickup confirmed");
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "EARNED", balanceBefore: 40, balanceAfter: 50 }),
        })
      );
    });

    it("confirms pickup of a free swap without paying anyone", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "CONFIRMED", creditAmount: 0 });
      const res = await patch({ action: "pickup" });
      expect(res.status).toBe(200);
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("returns 403 for a third party", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, buyerId: "u-9", cookId: "c-9" });
      const res = await patch({ action: "cancel" });
      expect(res.status).toBe(403);
    });

    it("refuses to cancel a picked-up swap", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "PICKED_UP" });
      const res = await patch({ action: "cancel" });
      expect(res.status).toBe(400);
      expect((await readBody(res)).message).toMatch(/Cannot cancel/);
    });

    it("refuses to cancel a completed swap", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "COMPLETED" });
      const res = await patch({ action: "cancel" });
      expect(res.status).toBe(400);
    });

    it("cancels and refunds the buyer", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "CONFIRMED" });
      mockPrisma.user.findUnique.mockImplementation(async (args: any) =>
        args.where?.id === "user-1" ? { ...mockUser, credits: 15 } : { ...mockUser }
      );
      const res = await patch({ action: "cancel", cancelReason: "Changed my mind" });
      expect(res.status).toBe(200);
      expect((await readBody(res)).message).toMatch(/cancelled and credits refunded/);
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: "REFUND", balanceBefore: 15, balanceAfter: 25 }),
        })
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: "SWAP_CANCELLED" }) })
      );
    });

    it("cancels a free swap without a refund", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, creditAmount: 0 });
      const res = await patch({ action: "cancel" });
      expect(res.status).toBe(200);
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe("rate", () => {
    it("returns 403 when the cook tries to rate", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "PICKED_UP" });
      const res = await patch({ action: "rate", score: 5 }, { ...mockUser, id: "cook-1" });
      expect(res.status).toBe(403);
    });

    it("requires pickup before rating", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "CONFIRMED" });
      const res = await patch({ action: "rate", score: 5 });
      expect(res.status).toBe(400);
      expect((await readBody(res)).message).toMatch(/only rate after pickup/);
    });

    it("rejects a score outside 1-5", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "PICKED_UP" });
      const res = await patch({ action: "rate", score: 6 });
      expect(res.status).toBe(400);
    });

    it("rejects a comment over 1000 characters", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "PICKED_UP" });
      const res = await patch({ action: "rate", score: 5, comment: "x".repeat(1001) });
      expect(res.status).toBe(400);
    });

    it("rejects a second rating", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({
        ...mockSwap,
        status: "PICKED_UP",
        rating: { id: "rating-1", score: 5 },
      });
      const res = await patch({ action: "rate", score: 4 });
      expect(res.status).toBe(400);
      expect((await readBody(res)).message).toMatch(/Already rated/);
    });

    it("submits the rating and completes the swap", async () => {
      mockPrisma.swap.findUnique.mockResolvedValue({ ...mockSwap, status: "PICKED_UP" });
      const res = await patch({ action: "rate", score: 5, comment: "Delicious!" });
      expect(res.status).toBe(200);
      expect((await readBody(res)).message).toBe("Rating submitted");
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.rating.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ score: 5, comment: "Delicious!" }),
        })
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: "SWAP_RATED" }) })
      );
    });
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.swap.findUnique.mockRejectedValue(new Error("db down"));
    const res = await patch({ action: "confirm" });
    expect(res.status).toBe(500);
  });
});
