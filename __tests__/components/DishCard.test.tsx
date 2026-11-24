import { render, screen } from "@testing-library/react";
import React from "react";
import { DishCard, DishCardSkeleton } from "@/components/dishes/DishCard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockDish = {
  id: "dish-1",
  title: "Mum's Biryani",
  description: "Authentic Pakistani biryani",
  image: undefined,
  category: "MAIN_COURSE",
  servings: 4,
  priceCredits: 8,
  priceMoney: undefined,
  currency: undefined,
  status: "AVAILABLE",
  pickupFrom: new Date(Date.now() + 3600000).toISOString(),
  pickupTo: new Date(Date.now() + 7200000).toISOString(),
  latitude: 40.7128,
  longitude: -74.006,
  city: "New York",
  isSwappable: true,
  isFree: false,
  tags: ["spicy", "rice"],
  cook: {
    id: "cook-1",
    name: "Fatima",
    avatar: undefined,
    isVerifiedCook: true,
    badges: [],
    totalSwaps: 15,
  },
  _count: { swaps: 1 },
};

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("DishCard", () => {
  it("renders dish title", () => {
    render(<DishCard dish={mockDish} />, { wrapper });
    expect(screen.getByText("Mum's Biryani")).toBeInTheDocument();
  });

  it("shows credit price", () => {
    render(<DishCard dish={mockDish} />, { wrapper });
    expect(screen.getByText(/8 cr/)).toBeInTheDocument();
  });

  it("shows cook name", () => {
    render(<DishCard dish={mockDish} />, { wrapper });
    expect(screen.getByText("Fatima")).toBeInTheDocument();
  });

  it("shows AVAILABLE status", () => {
    render(<DishCard dish={mockDish} />, { wrapper });
    expect(screen.getByText("AVAILABLE")).toBeInTheDocument();
  });

  it("shows Free label when isFree", () => {
    render(<DishCard dish={{ ...mockDish, isFree: true }} />, { wrapper });
    expect(screen.getByText("FREE")).toBeInTheDocument();
  });

  it("shows Swappable badge when isSwappable", () => {
    render(<DishCard dish={mockDish} />, { wrapper });
    expect(screen.getByText(/Swappable/)).toBeInTheDocument();
  });

  it("shows Hot badge when many swaps", () => {
    render(<DishCard dish={{ ...mockDish, _count: { swaps: 3 } }} />, { wrapper });
    expect(screen.getByText(/Hot/)).toBeInTheDocument();
  });

  it("shows emoji fallback when no image", () => {
    const { container } = render(<DishCard dish={mockDish} />, { wrapper });
    // Should render the emoji span
    expect(container.textContent).toMatch(/🍛/);
  });

  it("wraps in a link to dish detail", () => {
    render(<DishCard dish={mockDish} />, { wrapper });
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dish/dish-1");
  });
});

describe("DishCardSkeleton", () => {
  it("renders skeleton placeholder", () => {
    const { container } = render(<DishCardSkeleton />);
    expect(container.querySelector(".animate-shimmer")).toBeTruthy();
  });
});
