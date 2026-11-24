"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

type Step = "phone" | "otp" | "name";

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
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const fullPhone = `${countryCode}${phone.replace(/^0+/, "")}`;

  const handleSendOTP = async () => {
    if (!phone || phone.length < 7) {
      toast.error("Enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setIsNewUser(data.isNewUser);
      setStep("otp");
      toast.success(`OTP sent to ${fullPhone}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    if (isNewUser && !name.trim()) {
      toast.error("Enter your name");
      return;
    }
    setLoading(true);
    try {
      // Detect language and currency
      const lang = navigator.language?.split("-")[0] || "en";
      const supportedLangs = ["en", "ur", "de", "es"];
      const language = supportedLangs.includes(lang) ? lang : "en";

      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, code: otp, name: name.trim(), language }),
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
      toast.error(err.message || "Invalid OTP");
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
          {["phone", "otp", ...(isNewUser ? ["name"] : [])].map((s, i) => (
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
                  onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                />
              </div>
              <Button onClick={handleSendOTP} loading={loading} fullWidth size="lg">
                Send OTP →
              </Button>
              <p className="text-xs text-center text-stone-400">
                You'll receive a verification code via SMS
              </p>
            </div>
          )}

          {step === "otp" && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 animate-fade-in-up space-y-4">
              <h2 className="font-bold text-xl text-stone-900">Enter OTP</h2>
              <p className="text-sm text-stone-500">Sent to {fullPhone}</p>
              <Input
                type="number"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
                className="text-center text-2xl tracking-widest font-bold"
                maxLength={6}
              />
              {isNewUser && (
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  label="What's your name?"
                />
              )}
              <Button onClick={handleVerifyOTP} loading={loading} fullWidth size="lg">
                {isNewUser ? "Create Account 🎉" : "Sign In →"}
              </Button>
              <button
                onClick={() => setStep("phone")}
                className="w-full text-sm text-stone-400 hover:text-stone-600 transition-colors"
              >
                ← Change number
              </button>
            </div>
          )}
        </div>

        {/* Dev hint */}
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 text-xs text-stone-400 text-center bg-amber-50 rounded-xl px-4 py-2">
            Dev mode: OTP logged to server console
          </p>
        )}
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
