"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, ArrowLeftRight, Coins, User } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { clsx } from "clsx";

const navItems = [
  { href: "/feed", icon: Home, label: "Feed" },
  { href: "/swaps", icon: ArrowLeftRight, label: "Swaps" },
  { href: "/post", icon: PlusCircle, label: "Post", special: true },
  { href: "/credits", icon: Coins, label: "Credits" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAppStore();

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/60 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {navItems.map(({ href, icon: Icon, label, special }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200",
                special
                  ? "bg-green-600 text-white px-4 py-2 rounded-2xl shadow-lg scale-110 -mt-2"
                  : isActive
                  ? "text-green-600"
                  : "text-stone-400"
              )}
            >
              <Icon size={special ? 22 : 20} className={special ? "" : isActive ? "text-green-600" : ""} />
              {!special && (
                <span className={clsx("text-xs font-semibold", isActive ? "text-green-600" : "text-stone-400")}>
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
