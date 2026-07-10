export type CurrencyOption = {
  code: string;
  flag: string;
  label: string;
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "USD", flag: "🇺🇸", label: "US Dollar" },
  { code: "EUR", flag: "🇪🇺", label: "Euro" },
  { code: "GBP", flag: "🇬🇧", label: "British Pound" },
  { code: "CAD", flag: "🇨🇦", label: "Canadian Dollar" },
  { code: "AUD", flag: "🇦🇺", label: "Australian Dollar" },
  { code: "JPY", flag: "🇯🇵", label: "Japanese Yen" },
  { code: "CHF", flag: "🇨🇭", label: "Swiss Franc" },
  { code: "CNY", flag: "🇨🇳", label: "Chinese Yuan" },
  { code: "INR", flag: "🇮🇳", label: "Indian Rupee" },
  { code: "KRW", flag: "🇰🇷", label: "Korean Won" },
  { code: "SGD", flag: "🇸🇬", label: "Singapore Dollar" },
  { code: "HKD", flag: "🇭🇰", label: "Hong Kong Dollar" },
  { code: "BRL", flag: "🇧🇷", label: "Brazilian Real" },
  { code: "MXN", flag: "🇲🇽", label: "Mexican Peso" },
  { code: "SEK", flag: "🇸🇪", label: "Swedish Krona" },
  { code: "NOK", flag: "🇳🇴", label: "Norwegian Krone" },
  { code: "DKK", flag: "🇩🇰", label: "Danish Krone" },
  { code: "NZD", flag: "🇳🇿", label: "New Zealand Dollar" },
  { code: "PLN", flag: "🇵🇱", label: "Polish Złoty" },
  { code: "TRY", flag: "🇹🇷", label: "Turkish Lira" },
];
