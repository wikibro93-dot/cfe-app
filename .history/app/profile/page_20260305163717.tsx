"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { LogOut, Globe, DollarSign, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { translations, type Language } from "@/lib/i18n";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import Link from "next/link";

const BADGE_EMOJI: Record<string, string> = {
  top_donor: "💚 Top Donor",
  top_cook: "👨‍🍳 Top Cook",
  hot_dish: "🔥 Hot Dish",
  verified: "✅ Verified",
};

export default function ProfilePage() {
  const { token, user, setUser, logout, setLanguage, setCurrency, language, currency } = useAppStore();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || "", bio: user?.bio || "" });
  const [saving, setSaving] = useState(false);

  const { data: myDishes } = useQuery({
    queryKey: ["myDishes"],
    queryFn: async () => {
      const res = await fetch("/api/dishes?cookId=me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    enabled: !!token,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, language, currency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setUser({ ...user!, ...form, language, currency });
      toast.success("Profile updated!");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (!user) return null;

  return (
    <div>
      <Header title="Profile" />

      <div className="px-4 pt-4 space-y-5">
        {/* Avatar + name */}
        <div className="bg-white rounded-3xl p-6 border border-stone-100 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-3">
            {user.name[0].toUpperCase()}
          </div>
          <h2 className="font-playfair font-bold text-2xl text-stone-900">{user.name}</h2>
          {user.isVerifiedCook && (
            <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full mt-2 inline-block">
              ✓ Verified Cook
            </span>
          )}
          {user.bio && <p className="text-sm text-stone-500 mt-2">{user.bio}</p>}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-stone-50">
            {[
              { label: "Dishes", value: user.totalDishes },
              { label: "Swaps", value: user.totalSwaps },
              { label: "Credits", value: Math.round(user.credits) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="font-bold text-xl text-stone-900">{value}</p>
                <p className="text-xs text-stone-400 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* Badges */}
          {user.badges?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {user.badges.map((badge: string) => (
                <span key={badge} className="text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full">
                  {BADGE_EMOJI[badge] || badge}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Edit profile */}
        {!editing ? (
          <Button variant="outline" fullWidth onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-stone-100 space-y-3">
            <h3 className="font-bold text-stone-800">Edit Profile</h3>
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Textarea
              label="Bio"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              placeholder="Tell the community about yourself..."
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)} fullWidth>Cancel</Button>
              <Button onClick={handleSave} loading={saving} fullWidth>Save</Button>
            </div>
          </div>
        )}

        {/* Language & Currency */}
        <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-50">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={16} className="text-green-600" />
              <label className="text-sm font-bold text-stone-700">Language</label>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="en">🇬🇧 English</option>
              <option value="ur">🇵🇰 اردو (Urdu)</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="es">🇪🇸 Español</option>
            </select>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-green-600" />
              <label className="text-sm font-bold text-stone-700">Currency</label>
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {Object.entries(CURRENCIES).map(([code, { name, symbol }]) => (
                <option key={code} value={code}>
                  {symbol} {code} — {name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-green-600" />
              <label className="text-sm font-bold text-stone-700">Appearance</label>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Admin link */}
        {(user.role === "ADMIN" || user.role === "MODERATOR") && (
          <Link href="/admin">
            <div className="bg-stone-900 rounded-2xl p-4 flex items-center gap-3 text-white">
              <Shield size={20} />
              <span className="font-bold">Admin Dashboard</span>
            </div>
          </Link>
        )}

        {/* Logout */}
        <Button variant="danger" fullWidth onClick={handleLogout}>
          <LogOut size={16} /> Sign Out
        </Button>

        <p className="text-center text-xs text-stone-300 pb-4">
          CFE v1.0 · Built with ❤️ for communities everywhere
        </p>
      </div>
    </div>
  );
}
