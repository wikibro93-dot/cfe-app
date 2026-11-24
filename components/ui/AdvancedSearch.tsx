"use client";

import { useState } from "react";
import { SlidersHorizontal, X, ChevronDown, MapPin } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/Button";

export interface SearchFilters {
  search: string;
  category: string;
  minCredits: string;
  maxCredits: string;
  isFree: boolean;
  isSwappable: boolean;
  sortBy: "recent" | "credits_asc" | "credits_desc" | "distance";
  radius: number;
}

const DEFAULT_FILTERS: SearchFilters = {
  search: "",
  category: "ALL",
  minCredits: "",
  maxCredits: "",
  isFree: false,
  isSwappable: false,
  sortBy: "recent",
  radius: 5,
};

const CATEGORIES = [
  { value: "ALL", label: "All", emoji: "🍽️" },
  { value: "MAIN_COURSE", label: "Main Course", emoji: "🍛" },
  { value: "APPETIZER", label: "Appetizer", emoji: "🥗" },
  { value: "DESSERT", label: "Dessert", emoji: "🍰" },
  { value: "BREAKFAST", label: "Breakfast", emoji: "🍳" },
  { value: "SNACK", label: "Snack", emoji: "🍿" },
  { value: "BEVERAGE", label: "Beverage", emoji: "☕" },
  { value: "BAKED_GOODS", label: "Baked Goods", emoji: "🥐" },
  { value: "SOUP", label: "Soup", emoji: "🍲" },
  { value: "SALAD", label: "Salad", emoji: "🥙" },
];

const SORT_OPTIONS = [
  { value: "recent",       label: "Most Recent" },
  { value: "distance",     label: "Nearest First" },
  { value: "credits_asc",  label: "Credits: Low → High" },
  { value: "credits_desc", label: "Credits: High → Low" },
];

interface AdvancedSearchProps {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  resultCount?: number;
}

export function AdvancedSearch({ filters, onChange, resultCount }: AdvancedSearchProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const { setRadius } = useAppStore();

  const activeCount = [
    filters.category !== "ALL",
    filters.isFree,
    filters.isSwappable,
    !!filters.minCredits,
    !!filters.maxCredits,
    filters.sortBy !== "recent",
    filters.radius !== 5,
  ].filter(Boolean).length;

  const reset = () => {
    onChange(DEFAULT_FILTERS);
    setRadius(5);
  };

  const update = (partial: Partial<SearchFilters>) => {
    const next = { ...filters, ...partial };
    onChange(next);
    if (partial.radius !== undefined) setRadius(partial.radius);
  };

  return (
    <div className="space-y-3">
      {/* Search bar row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search dishes, cooks, ingredients..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 pl-10 text-sm font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {filters.search && (
            <button
              onClick={() => update({ search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X size={14} className="text-stone-400" />
            </button>
          )}
        </div>

        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={`relative px-3 py-2.5 rounded-xl border font-semibold text-sm flex items-center gap-1.5 transition-all ${
            panelOpen || activeCount > 0
              ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
              : "border-stone-200 bg-white text-stone-600 dark:border-stone-700 dark:bg-stone-800"
          }`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => update({ category: cat.value })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filters.category === cat.value
                ? "bg-green-600 text-white shadow-sm"
                : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
            }`}
          >
            {cat.emoji} {cat.label.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Advanced filter panel */}
      {panelOpen && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 p-4 space-y-4 shadow-lg">
          {/* Sort */}
          <div>
            <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2 block">
              Sort By
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ sortBy: opt.value as SearchFilters["sortBy"] })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    filters.sortBy === opt.value
                      ? "border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400"
                      : "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2 flex items-center gap-1">
              <MapPin size={11} /> Radius: <strong className="text-stone-700 dark:text-stone-200">{filters.radius} km</strong>
            </label>
            <input
              type="range"
              min={1} max={50} step={1}
              value={filters.radius}
              onChange={(e) => update({ radius: parseInt(e.target.value) })}
              className="w-full accent-green-600"
            />
            <div className="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>1 km</span><span>25 km</span><span>50 km</span>
            </div>
          </div>

          {/* Price range */}
          <div>
            <label className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-2 block">
              Credit Range
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number" min={0} placeholder="Min"
                value={filters.minCredits}
                onChange={(e) => update({ minCredits: e.target.value })}
                className="flex-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm font-medium dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-stone-400 text-sm">—</span>
              <input
                type="number" min={0} placeholder="Max"
                value={filters.maxCredits}
                onChange={(e) => update({ maxCredits: e.target.value })}
                className="flex-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-sm font-medium dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            {[
              { key: "isFree",      label: "💚 Free dishes only" },
              { key: "isSwappable", label: "🔄 Swappable only" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">{label}</span>
                <div
                  onClick={() => update({ [key]: !filters[key as keyof SearchFilters] } as any)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    filters[key as keyof SearchFilters] ? "bg-green-500" : "bg-stone-200 dark:bg-stone-700"
                  }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    filters[key as keyof SearchFilters] ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </div>
              </label>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800">
            {resultCount !== undefined && (
              <p className="text-xs text-stone-400 font-medium">{resultCount} results</p>
            )}
            <div className="flex gap-2 ml-auto">
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X size={13} /> Clear all
                </Button>
              )}
              <Button size="sm" onClick={() => setPanelOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
