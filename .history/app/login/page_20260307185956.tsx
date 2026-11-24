"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

type Step = "phone" | "name";

const COUNTRIES = [
  { code: "+1", flag: "🇺🇸", name: "US" },
  { code: "+44", flag: "🇬🇧", name: "UK" },
  { code: "+49", flag: "🇩🇪", name: "DE" },
  { code: "+92", flag: "🇵🇰", name: "PK" },
  { code: "+91", flag: "🇮🇳", name: "IN" },
  { code: "+55", flag: "🇧🇷", name: "BR" },
  { code: "+52", flag: "🇲🇽", name: "MX" },
  { code: "+234", flag: "🇳🇬", name: "NG" },
];

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken, setLanguage, setCurrency } = useAppStore();

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const fullPhone = `${countryCode}${phone.replace(/^0+/, "")}`;

  const handleLogin = async () => {
    if (!phone || phone.length < 7) {
      toast.error("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      // Detect language and currency
      const lang = navigator.language?.split("-")[0] || "en";
      const supportedLangs = ["en", "ur", "de", "es"];
      const language = supportedLangs.includes(lang) ? lang : "en";

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, name: name.trim(), language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setToken(data.token);
      setUser(data.user);
      setLanguage(data.user.language || language);
      setCurrency(data.user.currency || "USD");

      toast.success(`Welcome${isNewUser ? " to CFE!" : " back!"} 🎉`);
      router.replace("/feed");
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckUser = async () => {
    if (!phone || phone.length < 7) {
      toast.error("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      if (data.isNewUser) {
        setIsNewUser(true);
        setStep("name");
      } else {
        // Existing user, login directly
        await handleLogin();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to check user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-stone-50 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <div className="animate-float text-7xl mb-6">🍽️</div>
        <h1 className="font-playfair font-bold text-4xl text-stone-900 text-center mb-2">
          Community Food Exchange
        </h1>
        <p className="text-stone-500 text-center text-base font-medium mb-8">
          Share food. Build community. 🌍
        </p>

        {/* Step indicators */}
        <div className="flex gap-2 mb-8">
          {["phone", ...(isNewUser ? ["name"] : [])].map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step === s ? "w-8 bg-green-600" : "w-1.5 bg-stone-200"
              }`}
            />
          ))}
        </div>

        <div className="w-full max-w-sm space-y-4">
          {step === "phone" && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 animate-fade-in-up space-y-4">
              <h2 className="font-bold text-xl text-stone-900">Enter your number</h2>
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <Input
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCheckUser()}
                />
              </div>
              <Button onClick={handleCheckUser} loading={loading} fullWidth size="lg">
                Continue →
              </Button>
              <p className="text-xs text-center text-stone-400">
                Enter your phone number to login or sign up
              </p>
            </div>
          )}

          {step === "name" && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 animate-fade-in-up space-y-4">
              <h2 className="font-bold text-xl text-stone-900">What's your name?</h2>
              <p className="text-sm text-stone-500">We're creating your account for {fullPhone}</p>
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <Button onClick={handleLogin} loading={loading} fullWidth size="lg">
                Create Account 🎉
              </Button>
              <button
                onClick={() => {
                  setStep("phone");
                  setIsNewUser(false);
                }}
                className="w-full text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                ← Change number
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Features strip */}
      <div className="px-6 pb-8">
        <div className="flex justify-around text-center max-w-sm mx-auto">
          {[
            { emoji: "🔄", text: "Swap Dishes" },
            { emoji: "⭐", text: "Earn Credits" },
            { emoji: "🌍", text: "Global Ready" },
          ].map(({ emoji, text }) => (
            <div key={text} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs font-semibold text-stone-500">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
