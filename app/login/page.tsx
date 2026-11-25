"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/appStore";
import toast from "react-hot-toast";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase-client";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithRedirect,
  type User as FirebaseUser,
} from "firebase/auth";

// Sign-in is Google or Facebook via Firebase Auth — no passwords, no SMS
// codes. Firebase verifies who the person is; this app then issues its own
// httpOnly session cookie (POST /api/auth/social). The old phone+OTP form
// was removed: the app is free with no revenue, and every SMS code would
// be paid out of pocket. Phone numbers are now optional in the profile;
// the OTP code stays in the codebase for a possible later "verified
// number" badge. No token is stored by this page: the session lives in an
// httpOnly cookie set by /api/auth/social.

const LANGUAGES = ["en", "ur", "de", "es"];

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.45 2.9h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setLanguage, setCurrency, setNotificationCount } = useAppStore();

  const [loading, setLoading] = useState<"facebook" | "google" | "finishing" | null>(null);
  const [configured] = useState(isFirebaseConfigured());

  const finishSignIn = useCallback(
    async (fbUser: FirebaseUser) => {
      setLoading("finishing");
      try {
        const idToken = await fbUser.getIdToken();
        const lang = navigator.language?.split("-")[0] || "en";
        const language = LANGUAGES.includes(lang) ? lang : "en";

        const res = await fetch("/api/auth/social", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, language }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        setUser(data.user);
        setLanguage(data.user.language || language);
        setCurrency(data.user.currency || "USD");
        setNotificationCount(data.unreadCount || 0);

        toast.success(`Welcome${data.isNewUser ? " to CFE!" : " back!"} 🎉`);
        router.replace("/feed");
      } catch (err: any) {
        toast.error(err.message || "Sign-in failed");
      } finally {
        setLoading(null);
      }
    },
    [router, setUser, setLanguage, setCurrency, setNotificationCount]
  );

  // After the redirect back from Google/Facebook, complete the sign-in.
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) void finishSignIn(result.user);
        else if (auth.currentUser) void finishSignIn(auth.currentUser);
      })
      .catch((err) => {
        console.error("Sign-in redirect error:", err);
        toast.error("Sign-in failed — please try again");
      });
  }, [finishSignIn]);

  const signIn = async (providerName: "facebook" | "google") => {
    const auth = getFirebaseAuth();
    if (!auth) {
      toast.error("Sign-in is still being set up — please check back soon");
      return;
    }
    setLoading(providerName);
    try {
      const provider =
        providerName === "facebook"
          ? new FacebookAuthProvider()
          : new GoogleAuthProvider();
      // Redirect (not a popup): popups are often blocked on mobile browsers.
      await signInWithRedirect(auth, provider);
      // The page navigates away to the provider; finishSignIn runs on return.
    } catch (err: any) {
      console.error("Sign-in start error:", err);
      toast.error(err.message || "Could not start sign-in");
      setLoading(null);
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

        <div className="w-full max-w-sm space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 animate-fade-in-up space-y-3">
            <h2 className="font-bold text-xl text-stone-900">Welcome</h2>
            <p className="text-sm text-stone-500">
              Sign in to share food and swap dishes with neighbours.
            </p>
            <button
              onClick={() => signIn("facebook")}
              disabled={!configured || loading !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] text-white font-semibold py-3 px-4 hover:bg-[#166fe5] transition-colors disabled:opacity-50"
            >
              <FacebookIcon /> Continue with Facebook
            </button>
            <button
              onClick={() => signIn("google")}
              disabled={!configured || loading !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white text-stone-700 font-semibold py-3 px-4 hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              <GoogleIcon /> Continue with Google
            </button>
            {loading === "finishing" && (
              <p className="text-sm text-center text-stone-500">Finishing sign-in…</p>
            )}
            {!configured && (
              <p className="text-xs text-center text-amber-600">
                Sign-in is still being set up — please check back soon.
              </p>
            )}
            <p className="text-xs text-center text-stone-400">
              No password to remember. We never see your Google or Facebook password.
            </p>
          </div>
        </div>
      </div>

      {/* Features strip */}
      <div className="px-6 pb-4">
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

      {/* Legal links */}
      <div className="px-6 pb-8 text-center text-xs text-stone-400">
        <a href="/privacy" className="hover:text-stone-600 underline">
          Privacy Policy
        </a>
        <span className="mx-2">·</span>
        <a href="/terms" className="hover:text-stone-600 underline">
          Terms of Service
        </a>
      </div>
    </div>
  );
}
