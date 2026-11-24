"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

// Sign-in is SMS one-time code only. The old passwordless phone login
// (POST /api/auth/login) was removed — it issued a token for any phone
// number with no verification. No token is stored by this page: the
// session lives in an httpOnly cookie set by /api/auth/verify-otp.

type Step = "phone" | "name" | "otp";

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
  const { setUser, setLanguage, setCurrency, setNotificationCount } = useAppStore();

  const [step, setStep] = useState<Step>("phone");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const fullPhone = `${countryCode}${phone.replace(/^0+/, "")}`;

  const sendOtp = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep("otp");
      toast.success("OTP sent — check your SMS");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
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
        await sendOtp();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to check user");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code from your SMS");
      return;
    }
    setLoading(true);
    try {
      const lang = navigator.language?.split("-")[0] || "en";
      const supportedLangs = ["en", "ur", "de", "es"];
      const language = supportedLangs.includes(lang) ? lang : "en";

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code, name: name.trim(), language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUser(data.user);
      setLanguage(data.user.language || language);
      setCurrency(data.user.currency || "USD");
      setNotificationCount(data.unreadCount || 0);

      toast.success(`Welcome${isNewUser ? " to CFE!" : " back!"} 🎉`);
      router.replace("/feed");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-emerald-50 to-stone-50 flex flex-col">
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
          {["phone", ...(isNewUser ? ["name"] : []), "otp"].map((s) => (
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
                We will text you a 6-digit code to sign in
              </p>
            </div>
          )}

          {step === "name" && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 animate-fade-in-up space-y-4">
              <h2 className="font-bold text-xl text-stone-900">What&apos;s your name?</h2>
              <p className="text-sm text-stone-500">We&apos;re creating your account for {fullPhone}</p>
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
              />
              <Button onClick={sendOtp} loading={loading} fullWidth size="lg">
                Send OTP 🎉
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

          {step === "otp" && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 animate-fade-in-up space-y-4">
              <h2 className="font-bold text-xl text-stone-900">Enter the code</h2>
              <p className="text-sm text-stone-500">We sent a 6-digit code to {fullPhone}. It expires in 10 minutes.</p>
              <Input
                type="tel"
                placeholder="123456"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
              <Button onClick={handleVerify} loading={loading} fullWidth size="lg">
                Verify &amp; Continue →
              </Button>
              <button
                onClick={sendOtp}
                disabled={loading}
                className="w-full text-sm text-green-600 hover:text-green-700 font-semibold transition-colors disabled:opacity-40"
              >
                Resend code
              </button>
              <button
                onClick={() => {
                  setStep("phone");
                  setCode("");
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
