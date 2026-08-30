import { redirect } from "next/navigation"
import { FileImportIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ProductCatalog } from "./product-catalog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { getServerCatalogProducts } from "@/lib/api/catalog.server"
import { getServerChannelConnections } from "@/lib/api/channels.server"
import { getActiveStoreContext } from "@/lib/stores/active-store"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const { activeStore } = await getActiveStoreContext()

  if (!activeStore) {
    redirect(APP_ROUTES.onboarding)
  }

  const [products, connections] = await Promise.all([
    getServerCatalogProducts(activeStore.id),
    getServerChannelConnections(activeStore.id),
  ])
  const variantCount = products.reduce(
    (total, product) => total + product.variants.length,
    0
  )
  const totalStock = products.reduce(
    (productTotal, product) =>
      productTotal +
      product.variants.reduce(
        (variantTotal, variant) => variantTotal + variant.stock,
        0
      ),
    0
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Ürünler
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <CatalogBadge label="Ürün" value={products.length} />
            <CatalogBadge label="Varyant" value={variantCount} />
            <CatalogBadge label="Toplam stok" value={totalStock} />
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

      <ProductCatalog products={products} />
    </div>
  )
}

function CatalogFreshness({
  connections,
}: {
  connections: Awaited<ReturnType<typeof getServerChannelConnections>>
}) {
  const isSyncing = connections.some(
    (connection) => connection.processingStartedAt
  )
  const lastInventorySyncAt = connections
    .map(
      (connection) => connection.lastInventorySyncAt ?? connection.lastSyncAt
    )
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const hasFailure = connections.some((connection) => connection.failureReason)
  const hasCompletedSync = Boolean(lastInventorySyncAt)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-2">
        <span
          className={`size-1.5 rounded-full ${
            isSyncing
              ? "animate-pulse bg-amber-500"
              : hasFailure
                ? "bg-destructive"
                : hasCompletedSync
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/50"
          }`}
        />
        {isSyncing
          ? "Ürün bilgileri güncelleniyor"
          : lastInventorySyncAt
            ? `Son stok kontrolü ${formatSyncDate(lastInventorySyncAt)}`
            : "Henüz stok senkronizasyonu yapılmadı"}
      </span>
      {hasFailure && !isSyncing ? (
        <span className="text-destructive">Son senkronizasyon başarısız</span>
      ) : null}
    </div>
  )
}

function formatSyncDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

function CatalogBadge({ label, value }: { label: string; value: number }) {
  return (
    <Badge
      variant="outline"
      className="gap-2 border-border bg-white px-3 py-1.5 text-foreground shadow-none dark:bg-card"
    >
      <span className="size-2 rounded-full bg-emerald-500" />
      {value.toLocaleString("tr-TR")} {label}
    </Badge>
  )
}
