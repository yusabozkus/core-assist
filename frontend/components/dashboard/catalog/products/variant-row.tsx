import { Badge } from "@/components/ui/badge"
import {
  formatPrice,
  getVariantAvailability,
} from "@/components/dashboard/catalog/products/product-catalog-utils"
import type { CatalogProductVariant } from "@/types/product"

export function VariantRow({ variant }: { variant: CatalogProductVariant }) {
  const availability = getVariantAvailability(variant)

  return (
    <tr className="transition-colors hover:bg-muted/20">
      <td className="px-5 py-3.5 font-medium text-foreground">
        {variant.title ?? "Standart"}
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
