import { t, translations } from "@/lib/i18n";

describe("i18n translations", () => {
  it("returns English translation for known key", () => {
    expect(t("en", "feed")).toBe("Feed");
  });

  it("returns Urdu translation", () => {
    expect(t("ur", "feed")).toBe("فیڈ");
  });

  it("returns German translation", () => {
    expect(t("de", "feed")).toBe("Feed");
  });

  it("returns Spanish translation", () => {
    expect(t("es", "feed")).toBe("Feed");
  });

  it("falls back to English for missing language key", () => {
    // @ts-expect-error intentionally invalid language
    expect(t("xx", "feed")).toBe("Feed");
  });

  it("falls back to English for missing translation key", () => {
    // @ts-expect-error intentionally invalid key
    expect(t("de", "nonexistent_key_xyz")).toBe("nonexistent_key_xyz");
  });

  it("all languages have same keys as English", () => {
    const englishKeys = Object.keys(translations.en);
    for (const lang of ["ur", "de", "es"] as const) {
      const langKeys = Object.keys(translations[lang]);
      for (const key of englishKeys) {
        expect(langKeys).toContain(key);
      }
    }
  });

  it("no empty string values in English", () => {
    for (const [key, value] of Object.entries(translations.en)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
