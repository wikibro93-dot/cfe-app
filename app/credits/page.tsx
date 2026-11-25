"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { TrendingUp, TrendingDown, Coins, Gift, Heart } from "lucide-react";

// NOTE: credit purchase is DISABLED (fix/critical-security). There is no
// Stripe integration, so purchases can never be verified — the old code
// minted credits from a client-supplied amount. The Buy tab and its
// "Payments processed securely via Stripe" claim were removed. Credits
// are earned by sharing dishes and spent/refunded through swaps only.

const TYPE_CONFIG: Record<string, { icon: string; color: string; sign: string }> = {
  EARNED: { icon: "🍽️", color: "text-green-600", sign: "+" },
  SPENT: { icon: "💸", color: "text-red-500", sign: "-" },
  PURCHASED: { icon: "💳", color: "text-blue-600", sign: "+" },
  DONATED: { icon: "💚", color: "text-emerald-600", sign: "-" },
  BONUS: { icon: "🎁", color: "text-amber-600", sign: "+" },
  REFERRAL: { icon: "👥", color: "text-purple-600", sign: "+" },
  REFUND: { icon: "↩️", color: "text-blue-500", sign: "+" },
};

export default function CreditsPage() {
  const { user, updateCredits } = useAppStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "donate">("overview");
  const [donateAmount, setDonateAmount] = useState("5");
  const [loading, setLoading] = useState(false);

  const { data } = useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      // Auth is the httpOnly cookie — no token header is sent.
      const res = await fetch("/api/credits", { credentials: "same-origin" });
      return res.json();
    },
    enabled: !!user,
  });

  const handleDonate = async () => {
    const amount = parseFloat(donateAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ type: "DONATE", amount }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      toast.success(result.message || "Thank you! 💚");

      // Update credits after donation
      const newBalance = (user?.credits || 0) - amount;
      updateCredits(newBalance);

      queryClient.invalidateQueries({ queryKey: ["credits"] });
      setTab("overview");
    } catch (err: any) {
      toast.error(err.message || "Donation failed");
    } finally {
      setLoading(false);
    }
  };

  const transactions = data?.transactions || [];

  return (
    <div>
      <Header title="Credits" />

      <div className="px-4 pt-4 space-y-5">
        {/* Balance card */}
        <div className="bg-linear-to-br from-green-600 to-emerald-700 rounded-3xl p-6 text-white">
          <p className="text-green-200 text-sm font-semibold mb-1">Your Balance</p>
          <div className="flex items-end gap-2">
            <span className="font-playfair font-bold text-5xl">{data?.balance ?? user?.credits ?? 0}</span>
            <span className="text-green-200 text-lg mb-1">credits</span>
          </div>
          <p className="text-green-200 text-xs mt-2">Earn by sharing dishes • Spend to get dishes</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 bg-stone-100 rounded-2xl p-1">
          {[
            { value: "overview", label: "History" },
            { value: "donate", label: "Donate 💚" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value as any)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                tab === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === "overview" && (
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <div className="text-center py-10">
                <Coins size={40} className="text-stone-200 mx-auto mb-3" />
                <p className="text-stone-400 font-medium">No transactions yet</p>
                <p className="text-stone-300 text-xs mt-1">Post a dish to start earning credits</p>
              </div>
            ) : (
              transactions.map((tx: any) => {
                const config = TYPE_CONFIG[tx.type] || { icon: "•", color: "text-stone-500", sign: "" };
                return (
                  <div key={tx.id} className="bg-white rounded-xl p-4 border border-stone-100 flex items-center gap-3">
                    <span className="text-xl">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800 truncate">{tx.description}</p>
                      <p className="text-xs text-stone-400">{format(new Date(tx.createdAt), "MMM d, h:mma")}</p>
                    </div>
                    <span className={`font-bold text-sm shrink-0 ${config.color}`}>
                      {config.sign}{Math.abs(tx.amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Donate tab */}
        {tab === "donate" && (
          <div className="space-y-4">
            <div className="bg-emerald-50 rounded-2xl p-4">
              <p className="font-bold text-emerald-800 mb-1">💚 Support the Platform</p>
              <p className="text-sm text-emerald-600">
                Donate credits to help keep CFE running and earn a special Donor badge!
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[1, 5, 10, 25].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setDonateAmount(amt.toString())}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    donateAmount === amt.toString()
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-stone-200 text-stone-600"
                  }`}
                >
                  {amt} credits
                </button>
              ))}
            </div>
            <Button fullWidth size="lg" onClick={handleDonate} loading={loading}>
              💚 Donate {donateAmount} Credits
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
