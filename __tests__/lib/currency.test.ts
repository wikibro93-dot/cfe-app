import { formatCurrency, getCurrencySymbol, CURRENCIES } from "@/lib/currency";

describe("formatCurrency", () => {
  it("formats USD correctly", () => {
    const result = formatCurrency(10.5, "USD");
    expect(result).toContain("10");
    expect(result).toContain("$");
  });

  it("formats EUR", () => {
    const result = formatCurrency(25, "EUR");
    expect(result).toContain("25");
  });

  it("formats PKR", () => {
    const result = formatCurrency(500, "PKR");
    expect(result).toContain("500");
  });

  it("handles zero", () => {
    const result = formatCurrency(0, "USD");
    expect(result).toContain("0");
  });

  it("handles unknown currency gracefully", () => {
    // @ts-expect-error intentionally invalid
    const result = formatCurrency(10, "XYZ");
    expect(result).toContain("10");
  });
});

describe("getCurrencySymbol", () => {
  it("returns $ for USD", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
  });

  it("returns € for EUR", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });

  it("returns ₨ for PKR", () => {
    expect(getCurrencySymbol("PKR")).toBe("₨");
  });

  it("returns code itself for unknown", () => {
    // @ts-expect-error intentionally invalid
    expect(getCurrencySymbol("XYZ")).toBe("XYZ");
  });
});

describe("CURRENCIES constant", () => {
  it("has USD", () => expect(CURRENCIES).toHaveProperty("USD"));
  it("has EUR", () => expect(CURRENCIES).toHaveProperty("EUR"));
  it("each entry has symbol, name, locale", () => {
    for (const [, curr] of Object.entries(CURRENCIES)) {
      expect(curr).toHaveProperty("symbol");
      expect(curr).toHaveProperty("name");
      expect(curr).toHaveProperty("locale");
    }
  });
});
