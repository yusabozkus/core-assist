import type { CatalogProductVariant } from "@/types/product"

export function getVariantAvailability(variant: CatalogProductVariant): {
  label: string
  variant: "success" | "warning" | "secondary"
} {
  if (variant.status === "UNAVAILABLE")
    return { label: "Kullanılamıyor", variant: "secondary" }
  if (variant.status === "ARCHIVED")
    return { label: "Arşivlendi", variant: "secondary" }
  if (variant.stock <= 0) return { label: "Tükendi", variant: "warning" }
  return { label: `${variant.stock} adet`, variant: "success" }
}

export function formatPriceRange(variants: CatalogProductVariant[]) {
  if (variants.length === 0) return "—"
  const prices = variants.map((variant) => variant.price)
  const minimum = Math.min(...prices)
  const maximum = Math.max(...prices)
  const currency = variants[0].currency
  if (minimum === maximum) return formatPrice(minimum, currency)
  return `${formatPrice(minimum, currency)} – ${formatPrice(maximum, currency)}`
}

export function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(price)
}

export function formatCatalogDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

export function getProviderName(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  return providerKey
}
