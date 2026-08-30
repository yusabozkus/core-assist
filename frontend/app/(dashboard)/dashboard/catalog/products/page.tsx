import { FileImportIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProductCatalog } from "./product-catalog"
import { CatalogBadge } from "@/components/dashboard/catalog/products/catalog-badge"
import { CatalogFreshness } from "@/components/dashboard/catalog/products/catalog-freshness"
import { Button } from "@/components/ui/button"
import { getServerCatalogProducts } from "@/lib/api/catalog.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getOperationalStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const { activeStore } = await getOperationalStoreContext()

  const [catalogPage, connections] = await Promise.all([
    getServerCatalogProducts(activeStore.id),
    getServerChannelConnections(activeStore.id),
  ])

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Ürünler
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <CatalogBadge label="Ürün" value={catalogPage.summary.products} />
            <CatalogBadge
              label="Varyant"
              value={catalogPage.summary.variants}
            />
            <CatalogBadge
              label="Toplam stok"
              value={catalogPage.summary.totalStock}
            />
          </div>
          <CatalogFreshness connections={connections} />
        </div>

        <div className="flex flex-wrap gap-2 sm:self-center">
          <Button type="button" variant="outline">
            <HugeiconsIcon icon={FileImportIcon} className="size-4" />
            Katalog içe aktar
          </Button>
          <Button type="button">
            <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
            Ürün ekle
          </Button>
        </div>
      </div>

      <ProductCatalog storeId={activeStore.id} initialPage={catalogPage} />
    </div>
  )
}
