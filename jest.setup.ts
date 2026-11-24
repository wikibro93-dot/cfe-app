import "@testing-library/jest-dom";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return Object.assign(document.createElement('img'), { src, alt });
  },
}));

// Mock socket.io-client
jest.mock("socket.io-client", () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

// Mock zustand store
jest.mock("@/store/appStore", () => ({
  useAppStore: jest.fn(() => ({
    token: "mock-token",
    user: {
      id: "user-1",
      name: "Test User",
      phone: "+1234567890",
      role: "COOK",
      credits: 25,
      currency: "USD",
      language: "en",
      isVerifiedCook: false,
      badges: [],
      totalSwaps: 0,
      totalDishes: 0,
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
  })),
}));

// Suppress console.error in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (typeof args[0] === "string" && args[0].includes("Warning:")) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
