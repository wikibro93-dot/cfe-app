import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { success, badRequest, serverError } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const north = parseFloat(searchParams.get("north") || "0");
    const south = parseFloat(searchParams.get("south") || "0");
    const east = parseFloat(searchParams.get("east") || "0");
    const west = parseFloat(searchParams.get("west") || "0");
    
    // Validate bounds
    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
      return badRequest("Invalid bounds parameters");
    }
    
    // Safety cap: prevent fetching too many dishes when zoomed out
    const zoomLevel = calculateZoomLevel(north, south, east, west);
    if (zoomLevel < 8) {
      // Too zoomed out - would return millions of rows
      return success({ dishes: [], count: 0, message: "Zoom in to see dishes" });
    }
    
    // Fetch dishes within bounds
    const dishes = await prisma.dish.findMany({
      where: {
        status: "AVAILABLE",
        pickupTo: { gte: new Date() },
        latitude: { gte: south, lte: north },
        longitude: { gte: west, lte: east },
      },
      take: 100, // Maximum dishes per viewport
      include: {
        cook: {
          select: {
            id: true,
            name: true,
            avatar: true,
            isVerifiedCook: true,
            badges: true,
            totalSwaps: true,
          },
        },
        _count: { select: { swaps: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    
    return success({
      dishes,
      count: dishes.length,
      bounds: { north, south, east, west },
    });
  } catch (error) {
    console.error("Get dishes by bounds error:", error);
    return serverError();
  }
}

// Helper function to estimate zoom level from bounds
function calculateZoomLevel(north: number, south: number, east: number, west: number): number {
  const latDiff = north - south;
  const lngDiff = east - west;
  
  // Rough approximation of zoom level based on bounds size
  // Smaller bounds = higher zoom level
  const maxDiff = Math.max(latDiff, lngDiff);
  
  if (maxDiff < 0.01) return 15;
  if (maxDiff < 0.05) return 13;
  if (maxDiff < 0.1) return 12;
  if (maxDiff < 0.5) return 10;
  if (maxDiff < 1) return 9;
  if (maxDiff < 5) return 8;
  if (maxDiff < 10) return 7;
  if (maxDiff < 20) return 6;
  return 5;
}
