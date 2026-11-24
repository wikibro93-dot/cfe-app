"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Users, Utensils, ArrowLeftRight, TrendingUp, Star, Shield } from "lucide-react";

export default function AdminPage() {
  const { token, user } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Forbidden");
      return res.json();
    },
    enabled: !!token && (user?.role === "ADMIN" || user?.role === "MODERATOR"),
  });

  if (!user || !["ADMIN", "MODERATOR"].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="text-stone-200 mx-auto mb-4" />
          <p className="text-stone-400 font-medium">Access denied</p>
        </div>
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div>
      <Header title="Admin Dashboard" />

      <div className="px-4 pt-4 space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Users, label: "Total Users", value: stats?.totalUsers, color: "bg-blue-50 text-blue-600" },
            { icon: Utensils, label: "Total Dishes", value: stats?.totalDishes, color: "bg-green-50 text-green-600" },
            { icon: ArrowLeftRight, label: "Total Swaps", value: stats?.totalSwaps, color: "bg-purple-50 text-purple-600" },
            { icon: TrendingUp, label: "Success Rate", value: stats ? `${stats.successRate}%` : "—", color: "bg-amber-50 text-amber-600" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-stone-100">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                <Icon size={20} />
              </div>
              <p className="font-bold text-2xl text-stone-900">
                {isLoading ? "—" : value ?? 0}
              </p>
              <p className="text-xs text-stone-400 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Active dishes */}
        <div className="bg-white rounded-2xl p-4 border border-stone-100">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-stone-800">Active Dishes</p>
            <span className="text-green-600 font-bold">{stats?.activeDishes ?? 0}</span>
          </div>
          <div className="bg-stone-100 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: stats ? `${Math.min((stats.activeDishes / Math.max(stats.totalDishes, 1)) * 100, 100)}%` : "0%" }}
            />
          </div>
        </div>

        {/* Top Cooks */}
        {data?.topCooks?.length > 0 && (
          <div>
            <h3 className="font-bold text-stone-700 mb-3">🏆 Top Cooks</h3>
            <div className="space-y-2">
              {data.topCooks.map((cook: any, i: number) => (
                <div key={cook.id} className="bg-white rounded-2xl p-4 border border-stone-100 flex items-center gap-3">
                  <span className="text-lg font-bold text-stone-300 w-6">#{i + 1}</span>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700">
                    {cook.name[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-stone-800 text-sm">{cook.name}</p>
                    <p className="text-xs text-stone-400">{cook.totalSwaps} swaps • {cook.totalDishes} dishes</p>
                  </div>
                  {cook.badges?.includes("top_cook") && (
                    <span className="text-sm">👨‍🍳</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Users */}
        {data?.recentUsers?.length > 0 && (
          <div>
            <h3 className="font-bold text-stone-700 mb-3">👤 Recent Users</h3>
            <div className="space-y-2">
              {data.recentUsers.slice(0, 5).map((u: any) => (
                <div key={u.id} className="bg-white rounded-xl p-3 border border-stone-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-500 text-sm shrink-0">
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-stone-800 text-sm truncate">{u.name}</p>
                    <p className="text-xs text-stone-400 truncate">{u.phone}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    u.role === "ADMIN" ? "bg-red-100 text-red-600" : "bg-stone-100 text-stone-500"
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
