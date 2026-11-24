// Deep mock of the Prisma client exposed by "@/lib/db".
//
// API route tests point "@/lib/db" at this mock (jest.mock in each test
// file), so no real database connection is ever created and no network
// calls happen. lib/auth.ts and lib/middleware.ts import the same module,
// so they exercise the real auth/middleware code against this mock.
//
// Usage in a test file:
//   jest.mock("@/lib/db", () => {
//     const { mockPrisma } = require("../helpers/prismaMock");
//     return { prisma: mockPrisma };
//   });
//   beforeEach(() => resetMockPrisma());

export const mockUser = {
  id: "user-1",
  phone: "+15551234567",
  name: "Test User",
  avatar: null,
  bio: null,
  role: "COOK",
  credits: 25,
  latitude: 40.71,
  longitude: -74.0,
  city: "New York",
  country: "USA",
  currency: "USD",
  language: "en",
  timezone: "UTC",
  isVerified: true,
  isVerifiedCook: false,
  badges: [] as string[],
  totalSwaps: 3,
  totalDishes: 2,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

export const mockAdmin = {
  ...mockUser,
  id: "admin-1",
  phone: "+15550009999",
  name: "Admin User",
  role: "ADMIN",
};

export const mockCook = {
  ...mockUser,
  id: "cook-1",
  phone: "+15550001111",
  name: "Fatima",
  isVerifiedCook: true,
  totalSwaps: 5,
};

export const mockDish = {
  id: "dish-1",
  title: "Mum's Biryani",
  description: "Authentic Pakistani biryani",
  ingredients: ["rice", "chicken"],
  category: "MAIN_COURSE",
  image: null,
  servings: 4,
  quantity: "4",
  unit: "servings",
  priceCredits: 10,
  priceMoney: null,
  currency: "USD",
  status: "AVAILABLE",
  pickupFrom: new Date(Date.now() + 3600_000),
  pickupTo: new Date(Date.now() + 7200_000),
  latitude: 40.71,
  longitude: -74.0,
  address: "123 Main St",
  city: "New York",
  country: "USA",
  isSwappable: true,
  isFree: false,
  tags: ["spicy"],
  viewCount: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  cookId: "cook-1",
  cook: {
    id: "cook-1",
    name: "Fatima",
    avatar: null,
    isVerifiedCook: true,
    badges: [] as string[],
    totalSwaps: 5,
  },
};

export const mockSwap = {
  id: "swap-1",
  type: "CREDITS",
  status: "PENDING",
  creditAmount: 10,
  moneyAmount: null,
  currency: null,
  message: "Please!",
  confirmedAt: null,
  pickedUpAt: null,
  cancelledAt: null,
  cancelReason: null,
  buyerLat: null,
  buyerLng: null,
  buyerLocationAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  dishId: "dish-1",
  buyerId: "user-1",
  cookId: "cook-1",
  rating: null,
  dish: { ...mockDish },
  buyer: { id: "user-1", name: "Test User", avatar: null, phone: "+15551234567" },
  cook: { id: "cook-1", name: "Fatima", avatar: null, phone: "+15550001111" },
};

function modelMock() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    groupBy: jest.fn(),
  };
}

/** Copy only plain (non-Prisma-operator) fields from an update `data` object. */
function plainFields(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      continue; // Prisma operators like { increment: 1 } / { push: "x" }
    }
    out[key] = value;
  }
  return out;
}

export const mockPrisma: any = {
  user: modelMock(),
  oTP: modelMock(),
  dish: modelMock(),
  swap: modelMock(),
  creditTransaction: modelMock(),
  notification: modelMock(),
  chatMessage: modelMock(),
  rating: modelMock(),
  $transaction: jest.fn(),
};

/** Reset every mock and install sensible defaults. Call in beforeEach. */
export function resetMockPrisma(): void {
  const p: any = mockPrisma;
  const models = [
    p.user,
    p.oTP,
    p.dish,
    p.swap,
    p.creditTransaction,
    p.notification,
    p.chatMessage,
    p.rating,
  ];
  for (const m of models) {
    for (const fn of Object.values(m)) (fn as jest.Mock).mockReset();
  }
  p.$transaction.mockReset();
  // Run the callback against this same mock, so tx.user / tx.dish / ...
  // behave exactly like the top-level client.
  p.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => fn(p));

  // getAuthUser looks the signed-in user up by id, so return the user
  // matching the requested id (admin/cook get their own role).
  p.user.findUnique.mockImplementation(async (args: any) => {
    const id = args?.where?.id as string | undefined;
    if (id === "admin-1") return { ...mockAdmin };
    if (id === "cook-1") return { ...mockCook };
    if (id === "mod-1") return { ...mockUser, id: "mod-1", role: "MODERATOR", name: "Mod" };
    if (id) return { ...mockUser, id };
    if (args?.where?.phone) return { ...mockUser, phone: args.where.phone };
    return { ...mockUser };
  });
  p.user.findMany.mockResolvedValue([]);
  p.user.count.mockResolvedValue(0);
  p.user.create.mockImplementation(async ({ data }: any) => ({
    id: "user-new",
    ...data,
  }));
  p.user.update.mockImplementation(async ({ where, data }: any) => ({
    ...mockUser,
    id: where?.id ?? mockUser.id,
    ...plainFields(data),
  }));
  p.user.updateMany.mockResolvedValue({ count: 1 });

  p.oTP.findFirst.mockResolvedValue(null);
  p.oTP.updateMany.mockResolvedValue({ count: 0 });
  p.oTP.create.mockImplementation(async ({ data }: any) => ({
    id: "otp-1",
    ...data,
    attempts: 0,
    used: false,
  }));
  p.oTP.update.mockImplementation(async ({ data }: any) => ({
    id: "otp-1",
    ...plainFields(data),
  }));

  p.dish.findUnique.mockResolvedValue(null);
  p.dish.findFirst.mockResolvedValue(null);
  p.dish.findMany.mockResolvedValue([]);
  p.dish.count.mockResolvedValue(0);
  p.dish.create.mockImplementation(async ({ data }: any) => ({
    id: "dish-1",
    ...data,
    status: "AVAILABLE",
    viewCount: 0,
    createdAt: new Date(),
  }));
  p.dish.update.mockImplementation(async ({ where, data }: any) => ({
    id: where?.id ?? "dish-1",
    ...plainFields(data),
  }));
  p.dish.updateMany.mockResolvedValue({ count: 1 });

  p.swap.findUnique.mockResolvedValue(null);
  p.swap.findFirst.mockResolvedValue(null);
  p.swap.findMany.mockResolvedValue([]);
  p.swap.count.mockResolvedValue(0);
  p.swap.create.mockImplementation(async ({ data }: any) => ({
    id: "swap-1",
    ...data,
    status: "PENDING",
    createdAt: new Date(),
  }));
  p.swap.update.mockImplementation(async ({ where, data }: any) => ({
    id: where?.id ?? "swap-1",
    ...plainFields(data),
  }));
  p.swap.updateMany.mockResolvedValue({ count: 1 });

  p.creditTransaction.findMany.mockResolvedValue([]);
  p.creditTransaction.count.mockResolvedValue(0);
  p.creditTransaction.create.mockImplementation(async ({ data }: any) => ({
    id: "tx-1",
    ...data,
  }));
  p.creditTransaction.groupBy.mockResolvedValue([]);

  p.notification.count.mockResolvedValue(0);
  p.notification.findMany.mockResolvedValue([]);
  p.notification.findUnique.mockResolvedValue(null);
  p.notification.create.mockImplementation(async ({ data }: any) => ({
    id: "notif-1",
    ...data,
    read: false,
    createdAt: new Date(),
  }));
  p.notification.update.mockImplementation(async ({ data }: any) => ({
    ...plainFields(data),
  }));
  p.notification.updateMany.mockResolvedValue({ count: 0 });

  p.chatMessage.findMany.mockResolvedValue([]);
  p.chatMessage.create.mockImplementation(async ({ data }: any) => ({
    id: "msg-1",
    ...data,
    createdAt: new Date(),
  }));

  p.rating.create.mockImplementation(async ({ data }: any) => ({
    id: "rating-1",
    ...data,
  }));
}
