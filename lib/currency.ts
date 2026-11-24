export const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar", locale: "en-US" },
  EUR: { symbol: "€", name: "Euro", locale: "de-DE" },
  GBP: { symbol: "£", name: "British Pound", locale: "en-GB" },
  PKR: { symbol: "₨", name: "Pakistani Rupee", locale: "ur-PK" },
  INR: { symbol: "₹", name: "Indian Rupee", locale: "hi-IN" },
  BDT: { symbol: "৳", name: "Bangladeshi Taka", locale: "bn-BD" },
  MYR: { symbol: "RM", name: "Malaysian Ringgit", locale: "ms-MY" },
  CAD: { symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  AUD: { symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  NGN: { symbol: "₦", name: "Nigerian Naira", locale: "en-NG" },
  KES: { symbol: "KSh", name: "Kenyan Shilling", locale: "sw-KE" },
  ZAR: { symbol: "R", name: "South African Rand", locale: "en-ZA" },
  BRL: { symbol: "R$", name: "Brazilian Real", locale: "pt-BR" },
  MXN: { symbol: "MX$", name: "Mexican Peso", locale: "es-MX" },
  AED: { symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE" },
  SAR: { symbol: "﷼", name: "Saudi Riyal", locale: "ar-SA" },
  TRY: { symbol: "₺", name: "Turkish Lira", locale: "tr-TR" },
  IDR: { symbol: "Rp", name: "Indonesian Rupiah", locale: "id-ID" },
  PHP: { symbol: "₱", name: "Philippine Peso", locale: "en-PH" },
  THB: { symbol: "฿", name: "Thai Baht", locale: "th-TH" },
};

export type CurrencyCode = keyof typeof CURRENCIES;

// Country to currency mapping
export const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  US: "USD", GB: "GBP", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR",
  PK: "PKR", IN: "INR", BD: "BDT", MY: "MYR", CA: "CAD", AU: "AUD",
  NG: "NGN", KE: "KES", ZA: "ZAR", BR: "BRL", MX: "MXN", AE: "AED",
  SA: "SAR", TR: "TRY", ID: "IDR", PH: "PHP", TH: "THB",
};

let exchangeRatesCache: { rates: Record<string, number>; timestamp: number } | null = null;

export async function getExchangeRates(): Promise<Record<string, number>> {
  // Cache for 1 hour
  if (exchangeRatesCache && Date.now() - exchangeRatesCache.timestamp < 3600000) {
    return exchangeRatesCache.rates;
  }

  try {
    const apiKey = process.env.EXCHANGE_RATES_API_KEY;
    const res = await fetch(
      `https://api.exchangeratesapi.io/v1/latest?access_key=${apiKey}&base=USD`
    );
    const data = await res.json();
    if (data.rates) {
      exchangeRatesCache = { rates: data.rates, timestamp: Date.now() };
      return data.rates;
    }
  } catch {
    // fallback approximate rates
  }

  // Fallback rates if API fails
  return {
    USD: 1, EUR: 0.92, GBP: 0.79, PKR: 278, INR: 83, BDT: 110,
    MYR: 4.7, CAD: 1.36, AUD: 1.53, NGN: 1580, KES: 130, ZAR: 18.5,
    BRL: 5.0, MXN: 17.5, AED: 3.67, SAR: 3.75, TRY: 32, IDR: 15800,
    PHP: 56, THB: 35,
  };
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const curr = CURRENCIES[currency];
  if (!curr) return `${amount} ${currency}`;
  
  try {
    return new Intl.NumberFormat(curr.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${curr.symbol}${amount.toFixed(2)}`;
  }
}

export async function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode
): Promise<number> {
  if (from === to) return amount;
  const rates = await getExchangeRates();
  const fromRate = rates[from] || 1;
  const toRate = rates[to] || 1;
  return (amount / fromRate) * toRate;
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCIES[currency]?.symbol || currency;
}
