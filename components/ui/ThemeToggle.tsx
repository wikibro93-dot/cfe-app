"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (compact) {
    return (
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        title="Toggle theme"
      >
        {resolvedTheme === "dark" ? (
          <Sun size={18} className="text-amber-400" />
        ) : (
          <Moon size={18} className="text-stone-500" />
        )}
      </button>
    );
  }

  const options = [
    { value: "light", icon: Sun,     label: "Light" },
    { value: "system", icon: Monitor, label: "System" },
    { value: "dark",  icon: Moon,    label: "Dark"  },
  ] as const;

  return (
    <div className="flex items-center bg-stone-100 dark:bg-stone-800 rounded-2xl p-1 gap-1">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            theme === value
              ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm"
              : "text-stone-500 dark:text-stone-400"
          }`}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}
