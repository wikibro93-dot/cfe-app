"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { api } from "@/lib/api";

/**
 * Guards a page behind sign-in. The session is proven by the httpOnly
 * `cfe_token` cookie (sent automatically with the /auth/me request) — no
 * token is read from storage anymore.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, setUser, logout } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (user) return;

    api
      .get<{ id: string; name: string }>("/auth/me")
      .then((userData) => setUser(userData as any))
      .catch(() => {
        logout();
        router.replace("/login");
      });
  }, [user, setUser, logout, router]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-float text-4xl">🍽️</div>
          <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
