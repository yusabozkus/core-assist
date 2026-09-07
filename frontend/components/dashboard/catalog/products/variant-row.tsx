import { Badge } from "@/components/ui/badge"
import {
  formatPrice,
  getProviderName,
  getVariantAvailability,
} from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import type { CatalogProductVariant } from "@/types/product"

export function VariantRow({ variant }: { variant: CatalogProductVariant }) {
  const availability = getVariantAvailability(variant)

  return (
    <tr className="transition-colors hover:bg-muted/20">
      <td className="px-5 py-3.5 font-medium text-foreground">
        {variant.title ?? "Standart"}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {variant.providers.map((provider) => (
            <span
              key={provider}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <ProviderLogo
                provider={provider}
                className="size-4 rounded-sm border-0 shadow-none"
                sizes="16px"
              />
              {getProviderName(provider)}
            </span>
          ))}
        </div>
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
        {variant.sku}
      </td>
      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
        {variant.barcode ?? "—"}
      </td>
      <td className="px-5 py-3.5 text-muted-foreground">
        {variant.color ?? "—"}
      </td>
      <td className="px-5 py-3.5 text-muted-foreground">
        {variant.size ?? "—"}
      </td>
      <td className="px-5 py-3.5 font-medium text-foreground">
        {formatPrice(variant.price, variant.currency)}
      </td>
      <td className="px-5 py-3.5 text-right">
        <Badge variant={availability.variant} className="justify-center">
          {availability.label}
        </Badge>
      </td>
    </tr>
  )
}
