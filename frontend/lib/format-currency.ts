type CurrencyFormatOptions = Omit<
  Intl.NumberFormatOptions,
  "currency" | "currencyDisplay" | "style"
>

export function formatCurrency(
  value: number,
  currency = "TRY",
  options: CurrencyFormatOptions = {}
) {
  const formatter = new Intl.NumberFormat("tr-TR", {
    ...options,
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  })
  const parts = formatter.formatToParts(value)
  const currencySymbol =
    parts.find((part) => part.type === "currency")?.value ?? currency
  const formattedValue = parts
    .filter((part) => part.type !== "currency")
    .map((part) => part.value)
    .join("")
    .trim()

  return `${formattedValue} ${currencySymbol}`
}
