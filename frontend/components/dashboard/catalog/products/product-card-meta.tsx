import { ProviderLogoStack } from "@/components/dashboard/channels/provider-logo"
import { formatPrice } from "./product-catalog-utils"
import { cn } from "@/lib/utils"
import type { CatalogProductListItem } from "@/types/product"

export type ProductCardProps = {
  product: CatalogProductListItem
  onSelect: (productId: string) => void
}

export function ProductCardProviders({
  product,
}: {
  product: CatalogProductListItem
}) {
  const providers = [
    ...new Set(product.providers.map((item) => item.providerKey)),
  ]
  return <ProviderLogoStack providers={providers} />
}

export function ProductCardPrice({
  product,
}: {
  product: CatalogProductListItem
}) {
  if (product.minimumPrice === null || product.maximumPrice === null) {
    return (
      <span className="text-xs font-normal text-muted-foreground">
        Fiyat bilgisi yok
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1 text-sm font-semibold text-foreground tabular-nums">
      <span className="whitespace-nowrap">
        {formatPrice(product.minimumPrice, product.currency)}
      </span>
      {product.maximumPrice !== product.minimumPrice ? (
        <>
          <span className="font-normal text-muted-foreground">–</span>
          <span className="whitespace-nowrap">
            {formatPrice(product.maximumPrice, product.currency)}
          </span>
        </>
      ) : null}
    </span>
  )
}

export function ProductCardInventory({
  product,
}: {
  product: CatalogProductListItem
}) {
  const unavailable =
    product.status === "ARCHIVED" ||
    (product.providers.length > 0 &&
      product.providers.every((provider) => provider.status !== "ACTIVE"))
  return (
    <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs tabular-nums">
      <span className="whitespace-nowrap text-muted-foreground">
        <span className="font-medium text-foreground">
          {product.variantCount.toLocaleString("tr-TR")}
        </span>{" "}
        varyant
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          unavailable
            ? "text-muted-foreground"
            : product.totalStock > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
        )}
      >
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
        {unavailable
          ? "Satışta değil"
          : product.totalStock > 0
            ? `${product.totalStock.toLocaleString("tr-TR")} adet stok`
            : "Stok tükendi"}
      </span>
    </span>
  )
}
