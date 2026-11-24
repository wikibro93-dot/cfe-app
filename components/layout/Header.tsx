"use client";

import { Bell, Settings, MapPin } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface HeaderProps {
  title?: string;
  showLocation?: boolean;
  rightAction?: React.ReactNode;
}

export function Header({ title, showLocation, rightAction }: HeaderProps) {
  const { user, notificationCount } = useAppStore();

  return (
    <header className="sticky top-0 z-40 glass border-b border-white/60 dark:border-stone-800">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <div className="flex flex-col">
          {title ? (
            <h1 className="font-bold text-stone-900 text-lg leading-tight">{title}</h1>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🍽️</span>
              <span className="font-playfair font-bold text-green-700 text-lg">CFE</span>
            </div>
          )}
          {showLocation && user?.city && (
            <div className="flex items-center gap-1 text-xs text-stone-400 font-medium">
              <MapPin size={10} />
              <span>{user.city}{user.country ? `, ${user.country}` : ""}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rightAction}
          <Link href="/notifications" className="relative p-2 rounded-xl hover:bg-stone-100 transition-colors">
            <Bell size={20} className="text-stone-600" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
          <Link href="/profile" className="p-1 rounded-xl hover:bg-stone-100 transition-colors">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                {user?.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
