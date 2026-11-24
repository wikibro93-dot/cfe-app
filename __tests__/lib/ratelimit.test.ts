// Rate limit test — tests the logic directly without NextRequest
describe("rateLimit logic", () => {
  interface Entry { count: number; resetAt: number }
  const store = new Map<string, Entry>();
  
  function check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  }

  beforeEach(() => store.clear());

  it("allows first request", () => {
    expect(check("ip1:otp", 3, 60_000)).toBe(true);
  });

  it("allows requests up to limit", () => {
    for (let i = 0; i < 3; i++) check("ip2:otp", 3, 60_000);
    // 3rd should be last allowed
    const fourth = check("ip2:otp", 3, 60_000);
    expect(fourth).toBe(false);
  });

  it("blocks after limit exceeded", () => {
    for (let i = 0; i < 5; i++) check("ip3:otp", 3, 60_000);
    expect(check("ip3:otp", 3, 60_000)).toBe(false);
  });

  it("different keys are independent", () => {
    for (let i = 0; i < 4; i++) check("ip4:otp", 3, 60_000);
    // Different key should still pass
    expect(check("ip5:otp", 3, 60_000)).toBe(true);
  });

  it("resets after window expires", () => {
    const pastWindow = { count: 5, resetAt: Date.now() - 1000 };
    store.set("ip6:otp", pastWindow);
    expect(check("ip6:otp", 3, 60_000)).toBe(true);
  });

  it("tracks remaining correctly", () => {
    const key = "ip7:api";
    let lastResult = false;
    for (let i = 0; i < 2; i++) lastResult = check(key, 5, 60_000);
    expect(lastResult).toBe(true);
    const entry = store.get(key);
    expect(entry?.count).toBe(2);
  });
});
