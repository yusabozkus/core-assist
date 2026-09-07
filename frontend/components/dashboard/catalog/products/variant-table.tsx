import { VariantRow } from "@/components/dashboard/catalog/products/variant-row"
import type { CatalogProductVariant } from "@/types/product"

export function VariantTable({
  variants,
}: {
  variants: CatalogProductVariant[]
}) {
  if (variants.length === 0) {
    return (
      <div className="border-y border-border px-5 py-8 text-center text-sm text-muted-foreground">
        Bu ürün için varyant bilgisi bulunmuyor.
      </div>
    )
  }

  return (
    <div className="themed-scrollbar overflow-x-auto border-y border-border bg-card">
      <table className="w-full min-w-200 text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-medium">Varyant</th>
            <th className="px-5 py-3 font-medium">Kanal</th>
            <th className="px-5 py-3 font-medium">SKU</th>
            <th className="px-5 py-3 font-medium">Barkod</th>
            <th className="px-5 py-3 font-medium">Renk</th>
            <th className="px-5 py-3 font-medium">Beden</th>
            <th className="px-5 py-3 font-medium">Fiyat</th>
            <th className="px-5 py-3 text-right font-medium">Stok</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {variants.map((variant) => (
            <VariantRow key={variant.id} variant={variant} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
