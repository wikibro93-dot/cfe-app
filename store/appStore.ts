import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n";
import type { CurrencyCode } from "@/lib/currency";

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  credits: number;
  avatar?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  currency: CurrencyCode;
  language: Language;
  isVerifiedCook: boolean;
  badges: string[];
  bio?: string;
  totalSwaps: number;
  totalDishes: number;
}

interface AppState {
  user: User | null;
  // NOTE: there is deliberately NO token field here anymore. The auth token
  // lives in an httpOnly cookie (see lib/middleware.ts) and is never stored
  // in localStorage, where any script could read it.
  language: Language;
  currency: CurrencyCode;
  userLocation: { lat: number; lng: number } | null;
  radius: number; // km
  notificationCount: number;

  setUser: (user: User | null) => void;
  setLanguage: (lang: Language) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  setRadius: (radius: number) => void;
  setNotificationCount: (count: number) => void;
  updateCredits: (credits: number) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      language: "en",
      currency: "USD",
      userLocation: null,
      radius: 5,
      notificationCount: 0,

      setUser: (user) => set({ user }),
      setLanguage: (language) => set({ language }),
      setCurrency: (currency) => set({ currency }),
      setUserLocation: (userLocation) => set({ userLocation }),
      setRadius: (radius) => set({ radius }),
      setNotificationCount: (notificationCount) => set({ notificationCount }),
      updateCredits: (credits) =>
        set((state) => ({
          user: state.user ? { ...state.user, credits } : null,
        })),
      logout: () => {
        // Clear the httpOnly cookie server-side; local state clears at once.
        fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        set({ user: null, notificationCount: 0 });
      },
    }),
    {
      name: "cfe-storage",
      partialize: (state) => ({
        user: state.user,
        language: state.language,
        currency: state.currency,
        radius: state.radius,
        userLocation: state.userLocation,
      }),
    }
  )
);
