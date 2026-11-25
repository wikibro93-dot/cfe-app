/** @jest-environment node */
import { mockPrisma, mockUser, mockAdmin, mockDish, resetMockPrisma } from "../helpers/prismaMock";
import { makeReq, readBody } from "../helpers/request";

jest.mock("@/lib/db", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockPrisma } = require("../helpers/prismaMock");
  return { prisma: mockPrisma };
});

import { GET as listGet, POST as createPost } from "@/app/api/dishes/route";
import { GET as oneGet, PUT as onePut, DELETE as oneDelete } from "@/app/api/dishes/[id]/route";
import { GET as boundsGet } from "@/app/api/dishes/bounds/route";

const FUTURE_FROM = new Date(Date.now() + 3600_000).toISOString();
const FUTURE_TO = new Date(Date.now() + 7200_000).toISOString();

const validDish = {
  title: "Mum's Biryani",
  description: "Tasty",
  ingredients: ["rice", "chicken"],
  category: "MAIN_COURSE",
  image: "https://res.cloudinary.com/demo/image/upload/biryani.jpg",
  servings: 4,
  quantity: "4",
  unit: "servings",
  priceCredits: 10,
  priceMoney: 5,
  currency: "USD",
  pickupFrom: FUTURE_FROM,
  pickupTo: FUTURE_TO,
  latitude: 40.71,
  longitude: -74.0,
  address: "123 Main St",
  city: "New York",
  country: "USA",
  isSwappable: true,
  isFree: false,
  tags: ["spicy"],
};

describe("GET /api/dishes", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.dish.findMany.mockResolvedValue([{ ...mockDish }]);
    mockPrisma.dish.count.mockResolvedValue(1);
  });

  it("lists dishes with pagination", async () => {
    const res = await listGet(makeReq("/api/dishes"));
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.dishes).toHaveLength(1);
    expect(body.pagination).toEqual({ page: 1, limit: 20, total: 1, pages: 1 });
    expect(mockPrisma.dish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "AVAILABLE" }) })
    );
  });

  it("rejects invalid coordinates", async () => {
    const res = await listGet(makeReq("/api/dishes?lat=200&lng=0"));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid category", async () => {
    const res = await listGet(makeReq("/api/dishes?category=PIZZA"));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid sortBy", async () => {
    const res = await listGet(makeReq("/api/dishes?sortBy=random"));
    expect(res.status).toBe(400);
  });

  it("applies category, search, free, swappable and credit filters", async () => {
    const res = await listGet(
      makeReq(
        "/api/dishes?category=DESSERT&search=cake&isFree=true&isSwappable=true&minCredits=2&maxCredits=20&sortBy=credits_asc&page=2&limit=5"
      )
    );
    expect(res.status).toBe(200);
    const where = mockPrisma.dish.findMany.mock.calls[0][0].where;
    expect(where.category).toBe("DESSERT");
    expect(where.isFree).toBe(true);
    expect(where.isSwappable).toBe(true);
    expect(where.OR).toHaveLength(3);
    expect(where.priceCredits).toEqual({ gte: 2, lte: 20 });
    expect(mockPrisma.dish.findMany.mock.calls[0][0].orderBy).toEqual({ priceCredits: "asc" });
    expect(mockPrisma.dish.findMany.mock.calls[0][0].skip).toBe(5);
    expect(mockPrisma.dish.findMany.mock.calls[0][0].take).toBe(5);
  });

  it("sorts by credits descending", async () => {
    await listGet(makeReq("/api/dishes?sortBy=credits_desc"));
    expect(mockPrisma.dish.findMany.mock.calls[0][0].orderBy).toEqual({ priceCredits: "desc" });
  });

  it("clamps radius and limit", async () => {
    await listGet(makeReq("/api/dishes?lat=40.71&lng=-74&radius=100&limit=100"));
    const call = mockPrisma.dish.findMany.mock.calls[0][0];
    expect(call.take).toBe(50);
    expect(call.where.latitude).toBeDefined();
    expect(call.where.longitude).toBeDefined();
  });

  it("lets a cook see all of their own dishes with ?cookId=me", async () => {
    const res = await listGet(makeReq("/api/dishes?cookId=me", { user: mockUser }));
    expect(res.status).toBe(200);
    const where = mockPrisma.dish.findMany.mock.calls[0][0].where;
    expect(where.cookId).toBe("user-1");
    expect(where.status).toBeUndefined();
    expect(where.pickupTo).toBeUndefined();
  });

  it("requires sign-in for ?cookId=me", async () => {
    const res = await listGet(makeReq("/api/dishes?cookId=me"));
    expect(res.status).toBe(401);
  });

  it("filters by another cook's id (public, AVAILABLE only)", async () => {
    await listGet(makeReq("/api/dishes?cookId=cook-9"));
    const where = mockPrisma.dish.findMany.mock.calls[0][0].where;
    expect(where.cookId).toBe("cook-9");
    expect(where.status).toBe("AVAILABLE");
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.dish.findMany.mockRejectedValue(new Error("db down"));
    const res = await listGet(makeReq("/api/dishes"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/dishes", () => {
  beforeEach(() => resetMockPrisma());

  it("returns 401 without auth", async () => {
    const res = await createPost(
      makeReq("/api/dishes", { method: "POST", body: validDish })
    );
    expect(res.status).toBe(401);
  });

  it.each([
    ["short title", { title: "ab" }],
    ["missing title", { title: "" }],
    ["bad category", { category: "PIZZA" }],
    ["servings 0", { servings: 0 }],
    ["servings 101", { servings: 101 }],
    ["missing pickup", { pickupFrom: undefined, pickupTo: undefined }],
    ["pickup window reversed", { pickupFrom: FUTURE_TO, pickupTo: FUTURE_FROM }],
    ["pickup in the past", { pickupFrom: new Date(Date.now() - 7200_000).toISOString(), pickupTo: new Date(Date.now() - 3600_000).toISOString() }],
    ["bad latitude", { latitude: 200 }],
    ["bad longitude", { longitude: 200 }],
    ["negative credits", { priceCredits: -5 }],
    ["negative money", { priceMoney: -1 }],
    ["non-Cloudinary image", { image: "https://example.com/x.jpg" }],
    ["ingredients not an array", { ingredients: "rice" }],
    ["too many ingredients", { ingredients: Array.from({ length: 51 }, (_, i) => `i${i}`) }],
    ["too many tags", { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }],
    ["description too long", { description: "x".repeat(2001) }],
  ])("rejects %s", async (_label, patch) => {
    const res = await createPost(
      makeReq("/api/dishes", { method: "POST", body: { ...validDish, ...patch }, user: mockUser })
    );
    expect(res.status).toBe(400);
  });

  it("creates a dish and bumps the cook's dish count", async () => {
    const res = await createPost(
      makeReq("/api/dishes", { method: "POST", body: validDish, user: mockUser })
    );
    expect(res.status).toBe(201);
    const body = await readBody(res);
    expect(body.title).toBe("Mum's Biryani");
    expect(mockPrisma.dish.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Mum's Biryani", cookId: "user-1" }),
      })
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    );
  });

  it("accepts a dish without optional image and prices", async () => {
    const { image, priceCredits, priceMoney, ...rest } = validDish;
    const res = await createPost(
      makeReq("/api/dishes", { method: "POST", body: rest, user: mockUser })
    );
    expect(res.status).toBe(201);
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.dish.create.mockRejectedValue(new Error("db down"));
    const res = await createPost(
      makeReq("/api/dishes", { method: "POST", body: validDish, user: mockUser })
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/dishes/[id]", () => {
  beforeEach(() => resetMockPrisma());
  const params = { params: Promise.resolve({ id: "dish-1" }) };

  it("returns 404 for an unknown dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue(null);
    const res = await oneGet(makeReq("/api/dishes/dish-1"), params);
    expect(res.status).toBe(404);
  });

  it("returns the dish and increments the view count", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish });
    const res = await oneGet(makeReq("/api/dishes/dish-1"), params);
    expect(res.status).toBe(200);
    expect((await readBody(res)).title).toBe("Mum's Biryani");
    expect(mockPrisma.dish.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dish-1" },
        data: { viewCount: { increment: 1 } },
      })
    );
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.dish.findUnique.mockRejectedValue(new Error("db down"));
    const res = await oneGet(makeReq("/api/dishes/dish-1"), params);
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/dishes/[id]", () => {
  beforeEach(() => resetMockPrisma());
  const params = { params: Promise.resolve({ id: "dish-1" }) };

  it("returns 401 without auth", async () => {
    const res = await onePut(makeReq("/api/dishes/dish-1", { method: "PUT", body: {} }), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue(null);
    const res = await onePut(
      makeReq("/api/dishes/dish-1", { method: "PUT", body: { title: "New" }, user: mockUser }),
      params
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when another cook tries to edit", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "cook-9" });
    const res = await onePut(
      makeReq("/api/dishes/dish-1", { method: "PUT", body: { title: "New" }, user: mockUser }),
      params
    );
    expect(res.status).toBe(403);
  });

  it("lets an admin edit any dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "cook-9" });
    const res = await onePut(
      makeReq("/api/dishes/dish-1", { method: "PUT", body: { title: "New" }, user: mockAdmin }),
      params
    );
    expect(res.status).toBe(200);
  });

  it.each([
    ["short title", { title: "ab" }],
    ["bad category", { category: "PIZZA" }],
    ["servings 0", { servings: 0 }],
    ["bad status", { status: "EATEN" }],
    ["negative price", { priceCredits: -1 }],
    ["non-Cloudinary image", { image: "https://example.com/x.jpg" }],
    ["bad pickupFrom", { pickupFrom: "not-a-date" }],
    ["bad pickupTo", { pickupTo: "not-a-date" }],
    ["too many ingredients", { ingredients: Array.from({ length: 51 }, (_, i) => `i${i}`) }],
  ])("rejects %s", async (_label, patch) => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "user-1" });
    const res = await onePut(
      makeReq("/api/dishes/dish-1", { method: "PUT", body: patch, user: mockUser }),
      params
    );
    expect(res.status).toBe(400);
  });

  it("updates the dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "user-1" });
    const res = await onePut(
      makeReq("/api/dishes/dish-1", {
        method: "PUT",
        body: { title: "  New Title  ", status: "RESERVED", priceCredits: 5, latitude: 41, longitude: -73 },
        user: mockUser,
      }),
      params
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.dish.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dish-1" },
        data: expect.objectContaining({ title: "New Title", status: "RESERVED" }),
      })
    );
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "user-1" });
    mockPrisma.dish.update.mockRejectedValue(new Error("db down"));
    const res = await onePut(
      makeReq("/api/dishes/dish-1", { method: "PUT", body: { title: "New" }, user: mockUser }),
      params
    );
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/dishes/[id]", () => {
  beforeEach(() => resetMockPrisma());
  const params = { params: Promise.resolve({ id: "dish-1" }) };

  it("returns 401 without auth", async () => {
    const res = await oneDelete(makeReq("/api/dishes/dish-1", { method: "DELETE" }), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue(null);
    const res = await oneDelete(
      makeReq("/api/dishes/dish-1", { method: "DELETE", user: mockUser }),
      params
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when another cook tries to delete", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "cook-9" });
    const res = await oneDelete(
      makeReq("/api/dishes/dish-1", { method: "DELETE", user: mockUser }),
      params
    );
    expect(res.status).toBe(403);
  });

  it("refuses to delete a reserved dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "user-1", status: "RESERVED" });
    const res = await oneDelete(
      makeReq("/api/dishes/dish-1", { method: "DELETE", user: mockUser }),
      params
    );
    expect(res.status).toBe(400);
    expect((await readBody(res)).message).toMatch(/reserved/);
  });

  it("cancels the dish", async () => {
    mockPrisma.dish.findUnique.mockResolvedValue({ ...mockDish, cookId: "user-1" });
    const res = await oneDelete(
      makeReq("/api/dishes/dish-1", { method: "DELETE", user: mockUser }),
      params
    );
    expect(res.status).toBe(200);
    expect((await readBody(res)).message).toBe("Dish cancelled");
    expect(mockPrisma.dish.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "CANCELLED" } })
    );
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.dish.findUnique.mockRejectedValue(new Error("db down"));
    const res = await oneDelete(
      makeReq("/api/dishes/dish-1", { method: "DELETE", user: mockUser }),
      params
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/dishes/bounds", () => {
  beforeEach(() => {
    resetMockPrisma();
    mockPrisma.dish.findMany.mockResolvedValue([{ ...mockDish }]);
  });

  it("rejects non-numeric bounds", async () => {
    const res = await boundsGet(makeReq("/api/dishes/bounds?north=abc&south=0&east=0&west=0"));
    expect(res.status).toBe(400);
  });

  it("asks the user to zoom in when the viewport is too large", async () => {
    const res = await boundsGet(
      makeReq("/api/dishes/bounds?north=50&south=-50&east=100&west=-100")
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.dishes).toEqual([]);
    expect(body.count).toBe(0);
    expect(body.message).toMatch(/Zoom in/);
    expect(mockPrisma.dish.findMany).not.toHaveBeenCalled();
  });

  it("returns dishes inside the bounds", async () => {
    const res = await boundsGet(
      makeReq("/api/dishes/bounds?north=40.72&south=40.70&east=-73.99&west=-74.01")
    );
    expect(res.status).toBe(200);
    const body = await readBody(res);
    expect(body.dishes).toHaveLength(1);
    expect(body.count).toBe(1);
    expect(body.bounds).toEqual({ north: 40.72, south: 40.7, east: -73.99, west: -74.01 });
  });

  it("returns 500 when the database fails", async () => {
    mockPrisma.dish.findMany.mockRejectedValue(new Error("db down"));
    const res = await boundsGet(
      makeReq("/api/dishes/bounds?north=40.72&south=40.70&east=-73.99&west=-74.01")
    );
    expect(res.status).toBe(500);
  });
});
