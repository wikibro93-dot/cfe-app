import { haversineDistance, getBoundingBox } from "@/lib/geo";

describe("haversineDistance", () => {
  it("returns 0 for same coordinates", () => {
    expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates NYC to LA correctly (~3,940 km)", () => {
    const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it("calculates short distances accurately (<1 km)", () => {
    // ~111 meters apart
    const dist = haversineDistance(51.5, 0.0, 51.501, 0.0);
    expect(dist).toBeGreaterThan(0.09);
    expect(dist).toBeLessThan(0.15);
  });

  it("is symmetric", () => {
    const d1 = haversineDistance(10, 20, 30, 40);
    const d2 = haversineDistance(30, 40, 10, 20);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

describe("getBoundingBox", () => {
  it("returns a box with correct structure", () => {
    const box = getBoundingBox(40.7128, -74.006, 5);
    expect(box).toHaveProperty("minLat");
    expect(box).toHaveProperty("maxLat");
    expect(box).toHaveProperty("minLon");
    expect(box).toHaveProperty("maxLon");
  });

  it("minLat < lat < maxLat", () => {
    const box = getBoundingBox(40.7128, -74.006, 5);
    expect(box.minLat).toBeLessThan(40.7128);
    expect(box.maxLat).toBeGreaterThan(40.7128);
  });

  it("larger radius produces larger box", () => {
    const small = getBoundingBox(40, -74, 1);
    const large = getBoundingBox(40, -74, 10);
    expect(large.maxLat - large.minLat).toBeGreaterThan(small.maxLat - small.minLat);
  });
});
