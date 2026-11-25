import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { Input, Textarea } from "@/components/ui/Input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { AdvancedSearch, type SearchFilters } from "@/components/ui/AdvancedSearch";
import {
  mockSetTheme,
  mockUseTheme,
  mockUseAppStore,
  mockUsePathname,
  mockRouterReplace,
  mockApiGet,
} from "../helpers/componentMocks";

// NOTE: the factories require() the mocks helper lazily — see
// helpers/componentMocks.ts — so they work even though the components
// under test import these modules at the top of this file.
jest.mock("next-themes", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("../helpers/componentMocks");
  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useTheme: () => m.mockUseTheme(),
  };
});

jest.mock("@/store/appStore", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("../helpers/componentMocks");
  return { useAppStore: () => m.mockUseAppStore() };
});

jest.mock("next/navigation", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("../helpers/componentMocks");
  return {
    useRouter: () => ({ push: m.mockRouterPush, replace: m.mockRouterReplace, back: jest.fn() }),
    usePathname: () => m.mockUsePathname(),
    useParams: () => ({}),
    useSearchParams: () => new URLSearchParams(),
  };
});

jest.mock("@/lib/api", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("../helpers/componentMocks");
  return { api: { get: (...args: unknown[]) => m.mockApiGet(...args) } };
});

const defaultStore = {
  user: {
    id: "user-1",
    name: "Test User",
    phone: "+15551234567",
    role: "COOK",
    credits: 25,
    currency: "USD",
    language: "en",
    isVerifiedCook: false,
    badges: [],
    totalSwaps: 0,
    totalDishes: 0,
    city: "New York",
    country: "USA",
    avatar: undefined,
  },
  language: "en",
  currency: "USD",
  userLocation: { lat: 40.7128, lng: -74.006 },
  radius: 5,
  notificationCount: 0,
  setUser: jest.fn(),
  setToken: jest.fn(),
  setLanguage: jest.fn(),
  setCurrency: jest.fn(),
  setUserLocation: jest.fn(),
  setRadius: jest.fn(),
  setNotificationCount: jest.fn(),
  updateCredits: jest.fn(),
  logout: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAppStore.mockImplementation(() => ({ ...defaultStore }));
  mockUsePathname.mockImplementation(() => "/feed");
  mockUseTheme.mockImplementation(() => ({
    theme: "light",
    setTheme: mockSetTheme,
    resolvedTheme: "light",
  }));
});

describe("Input", () => {
  it("renders a label, input and hint", () => {
    render(<Input label="Title" hint="Keep it short" placeholder="Dish title" />);
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Dish title")).toBeInTheDocument();
    expect(screen.getByText("Keep it short")).toBeInTheDocument();
  });

  it("shows the error and hides the hint", () => {
    render(<Input label="Title" error="Required" hint="Keep it short" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("Keep it short")).not.toBeInTheDocument();
  });

  it("renders left and right icons", () => {
    render(<Input leftIcon={<span>LEFT</span>} rightIcon={<span>RIGHT</span>} />);
    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });

  it("forwards the ref to the input", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current?.tagName).toBe("INPUT");
  });
});

describe("Textarea", () => {
  it("renders a label and an error", () => {
    render(<Textarea label="Bio" error="Too long" placeholder="About you" />);
    expect(screen.getByText("Bio")).toBeInTheDocument();
    expect(screen.getByText("Too long")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("About you")).toBeInTheDocument();
  });

  it("renders without a label or error", () => {
    render(<Textarea placeholder="Notes" />);
    expect(screen.getByPlaceholderText("Notes")).toBeInTheDocument();
  });
});

describe("ThemeToggle", () => {
  it("renders Light/System/Dark options and switches theme", () => {
    render(<ThemeToggle />);
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Dark"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("renders a compact toggle that flips dark to light", () => {
    mockUseTheme.mockImplementation(() => ({
      theme: "dark",
      setTheme: mockSetTheme,
      resolvedTheme: "dark",
    }));
    render(<ThemeToggle compact />);
    fireEvent.click(screen.getByTitle("Toggle theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("renders a compact toggle that flips light to dark", () => {
    render(<ThemeToggle compact />);
    fireEvent.click(screen.getByTitle("Toggle theme"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});

describe("ThemeProvider", () => {
  it("renders its children", () => {
    render(
      <ThemeProvider>
        <span>child content</span>
      </ThemeProvider>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});

describe("SocketProvider", () => {
  it("renders its children", () => {
    render(
      <SocketProvider>
        <span>socket child</span>
      </SocketProvider>
    );
    expect(screen.getByText("socket child")).toBeInTheDocument();
  });
});

describe("AuthGuard", () => {
  it("renders children when the user is signed in", () => {
    render(
      <AuthGuard>
        <span>protected page</span>
      </AuthGuard>
    );
    expect(screen.getByText("protected page")).toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("loads the session and sets the user when signed in via cookie", async () => {
    mockUseAppStore.mockImplementation(() => ({ ...defaultStore, user: null }));
    mockApiGet.mockResolvedValue({ id: "user-1", name: "Test User" });
    render(
      <AuthGuard>
        <span>protected page</span>
      </AuthGuard>
    );
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith("/auth/me"));
    await waitFor(() =>
      expect(defaultStore.setUser).toHaveBeenCalledWith({ id: "user-1", name: "Test User" })
    );
  });

  it("logs out and redirects to login when the session check fails", async () => {
    mockUseAppStore.mockImplementation(() => ({ ...defaultStore, user: null }));
    mockApiGet.mockRejectedValue(new Error("unauthorized"));
    render(
      <AuthGuard>
        <span>protected page</span>
      </AuthGuard>
    );
    await waitFor(() => expect(defaultStore.logout).toHaveBeenCalled());
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/login"));
  });

  it("shows a loading spinner while there is no user", () => {
    mockUseAppStore.mockImplementation(() => ({ ...defaultStore, user: null }));
    mockApiGet.mockImplementation(() => new Promise(() => {}));
    const { container } = render(
      <AuthGuard>
        <span>protected page</span>
      </AuthGuard>
    );
    expect(screen.queryByText("protected page")).not.toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });
});

describe("BottomNav", () => {
  it("renders nothing when there is no user", () => {
    mockUseAppStore.mockImplementation(() => ({ ...defaultStore, user: null }));
    const { container } = render(<BottomNav />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all nav items and marks the active one", () => {
    render(<BottomNav />);
    for (const label of ["Feed", "Swaps", "Credits", "Profile"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const feedLink = screen.getByText("Feed").closest("a");
    expect(feedLink).toHaveAttribute("href", "/feed");
    expect(feedLink?.className).toContain("text-green-600");
  });

  it("marks no item active on an unknown path", () => {
    mockUsePathname.mockImplementation(() => "/unknown");
    render(<BottomNav />);
    expect(screen.getByText("Feed")).toBeInTheDocument();
  });
});

describe("Header", () => {
  it("renders the logo when no title is given", () => {
    render(<Header />);
    expect(screen.getByText("CFE")).toBeInTheDocument();
  });

  it("renders a title and the user's city", () => {
    render(<Header title="Feed" showLocation />);
    expect(screen.getByText("Feed")).toBeInTheDocument();
    expect(screen.getByText("New York, USA")).toBeInTheDocument();
  });

  it("shows the notification badge and caps it at 9+", () => {
    mockUseAppStore.mockImplementation(() => ({ ...defaultStore, notificationCount: 12 }));
    render(<Header />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("shows the exact count for a small number of notifications", () => {
    mockUseAppStore.mockImplementation(() => ({ ...defaultStore, notificationCount: 3 }));
    render(<Header />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows the avatar image when the user has one", () => {
    mockUseAppStore.mockImplementation(() => ({
      ...defaultStore,
      user: { ...defaultStore.user, avatar: "https://example.com/a.jpg" },
    }));
    render(<Header />);
    expect(screen.getByAltText("Test User")).toHaveAttribute("src", "https://example.com/a.jpg");
  });

  it("shows the user's initial when there is no avatar", () => {
    render(<Header />);
    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders a custom right action", () => {
    render(<Header rightAction={<button>Custom</button>} />);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});

const baseFilters: SearchFilters = {
  search: "",
  category: "ALL",
  minCredits: "",
  maxCredits: "",
  isFree: false,
  isSwappable: false,
  sortBy: "recent",
  radius: 5,
};

describe("AdvancedSearch", () => {
  it("renders the search box and the filters button", () => {
    render(<AdvancedSearch filters={baseFilters} onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText(/Search dishes/)).toBeInTheDocument();
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });

  it("shows the result count when given", () => {
    render(<AdvancedSearch filters={baseFilters} onChange={jest.fn()} resultCount={7} />);
    // The count is rendered in the filter panel footer, so open the panel first.
    fireEvent.click(screen.getByText("Filters"));
    expect(screen.getByText("7 results")).toBeInTheDocument();
  });

  it("calls onChange when the search text changes", () => {
    const onChange = jest.fn();
    render(<AdvancedSearch filters={baseFilters} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Search dishes/), {
      target: { value: "biryani" },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: "biryani" }));
  });

  it("clears the search text", () => {
    const onChange = jest.fn();
    render(
      <AdvancedSearch filters={{ ...baseFilters, search: "biryani" }} onChange={onChange} />
    );
    const searchBox = screen.getByPlaceholderText(/Search dishes/);
    const clearButton = searchBox.parentElement?.querySelector("button");
    expect(clearButton).toBeTruthy();
    fireEvent.click(clearButton as Element);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: "" }));
  });

  it("opens the filters panel and shows categories", () => {
    render(<AdvancedSearch filters={baseFilters} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText("Filters"));
    // Chips render "emoji + first word of the label" (e.g. "🍛 Main"), so match by regex.
    expect(screen.getByText(/Main/)).toBeInTheDocument();
    expect(screen.getByText(/Dessert/)).toBeInTheDocument();
    expect(screen.getByText("Sort By")).toBeInTheDocument();
    expect(screen.getByText(/Radius:/)).toBeInTheDocument();
  });

  it("changes the category when a chip is clicked", () => {
    const onChange = jest.fn();
    render(<AdvancedSearch filters={baseFilters} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Dessert/));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: "DESSERT" }));
  });

  it("changes the sort order from the panel", () => {
    const onChange = jest.fn();
    render(<AdvancedSearch filters={baseFilters} onChange={onChange} />);
    fireEvent.click(screen.getByText("Filters"));
    fireEvent.click(screen.getByText("Credits: Low → High"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sortBy: "credits_asc" }));
  });

  it("toggles the free-dishes filter", () => {
    const onChange = jest.fn();
    render(<AdvancedSearch filters={baseFilters} onChange={onChange} />);
    fireEvent.click(screen.getByText("Filters"));
    // The click handler lives on the toggle pill, not on the label text.
    const toggle = screen
      .getByText(/Free dishes only/)
      .closest("label")
      ?.querySelector(".w-11");
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle as Element);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isFree: true }));
  });

  it("closes the panel with Done", () => {
    render(<AdvancedSearch filters={baseFilters} onChange={jest.fn()} />);
    fireEvent.click(screen.getByText("Filters"));
    expect(screen.getByText("Sort By")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByText("Sort By")).not.toBeInTheDocument();
  });

  it("shows the active filter count badge", () => {
    render(
      <AdvancedSearch
        filters={{ ...baseFilters, category: "DESSERT", isFree: true }}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("resets the filters", () => {
    const onChange = jest.fn();
    render(
      <AdvancedSearch
        filters={{ ...baseFilters, category: "DESSERT", isFree: true }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("Filters"));
    fireEvent.click(screen.getByText(/Clear all/));
    expect(onChange).toHaveBeenCalledWith(baseFilters);
  });
});
