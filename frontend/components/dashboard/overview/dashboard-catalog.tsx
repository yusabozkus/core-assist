import Link from "next/link"
import { ArrowRight01Icon, Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ProductThumbnail } from "@/components/dashboard/catalog/products/product-thumbnail"
import { APP_ROUTES } from "@/constants/site"
import type { DashboardOverview } from "@/types/dashboard"
import { dashboardNumber as number } from "./dashboard-format"

export function DashboardCatalog({
  data,
  onSelectProduct,
}: {
  data: DashboardOverview
  onSelectProduct: (id: string) => void
}) {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
      aria-labelledby="popular-title"
    >
      <header className="flex items-start justify-between gap-3 px-5 py-5 sm:px-6">
        <div>
          <h2 id="popular-title" className="text-sm font-semibold">
            En çok sorulan ürünler
          </h2>
        </div>
        <Link
          href={APP_ROUTES.dashboard.catalog.products}
          className="text-xs font-medium text-primary hover:underline"
        >
          Ürünler
        </Link>
      </header>
      {data.popularProducts.length ? (
        <div className="grid border-t border-border/70 sm:grid-cols-2 xl:grid-cols-4">
          {data.popularProducts.map((product) => (
            <button
              type="button"
              key={product.id}
              onClick={() => onSelectProduct(product.id)}
              className="group flex w-full min-w-0 items-start gap-3 px-5 py-5 text-left transition-colors outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-6"
            >
              <ProductThumbnail
                title={product.title}
                imageUrl={product.imageUrl}
                className="h-16 w-12 sm:h-16 sm:w-12"
              />
              <span className="min-w-0 flex-1">
                <span
                  className="line-clamp-2 text-xs leading-5 font-medium"
                  title={product.title}
                >
                  {product.title}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {product.brand}
                </span>
                <span className="mt-2 block text-[11px] font-medium text-primary tabular-nums">
                  {number.format(product.questions)} soru
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-xs text-muted-foreground">
          <HugeiconsIcon icon={Package01Icon} className="size-6" />
          <p>Ürünlere eşleşen sorular geldikçe bu liste oluşur.</p>
        </div>
      )}
    </section>
  )
}

export function CatalogHealth({ data }: { data: DashboardOverview }) {
  const catalog = data.catalog
  const links = [
    {
      title: "Azalan stok",
      value: catalog.lowStock,
      status: "LOW_STOCK",
      tone: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Tükenen stok",
      value: catalog.outOfStock,
      status: "OUT_OF_STOCK",
      tone: "text-red-600 dark:text-red-400",
    },
    {
      title: "Güncelliği kontrol edilmeli",
      value: catalog.stale,
      status: "STALE",
      tone: "text-muted-foreground",
    },
  ]
  return (
    <section
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
      aria-labelledby="catalog-health-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="catalog-health-title" className="text-sm font-semibold">
          Katalog durumu
        </h2>
        <HugeiconsIcon
          icon={Package01Icon}
          className="size-4 text-muted-foreground"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {number.format(catalog.products)}
        </span>{" "}
        aktif ürün <span className="mx-1">·</span>{" "}
        {number.format(catalog.variants)} varyant
      </p>
      <div className="mt-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.status}
            href={`${APP_ROUTES.dashboard.catalog.inventory}?status=${link.status}`}
            className="flex items-center justify-between gap-3 rounded-lg py-2 text-xs outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>{link.title}</span>
            <span className="flex items-center gap-2">
              <span
                className={`font-medium tabular-nums ${link.value ? link.tone : "text-muted-foreground"}`}
              >
                {number.format(link.value)}
              </span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-3 text-muted-foreground"
              />
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-3 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground">
        Stok sayıları varyant bazındadır. Azalan stok:{" "}
        {catalog.lowStockThreshold} adet ve altı.{" "}
        {number.format(catalog.freshnessMinutes)} dakikadan eski stok verileri
        kontrol bekler.
      </p>
    </section>
  )
}
