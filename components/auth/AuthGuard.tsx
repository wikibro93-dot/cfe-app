"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { api } from "@/lib/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, user, setUser, logout } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!user) {
      api.get<{ id: string; name: string }>("/auth/me")
        .then((userData) => setUser(userData as any))
        .catch(() => {
          logout();
          router.replace("/login");
        });
    }
  }, [token, user]);

  if (!token || !user) {
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
