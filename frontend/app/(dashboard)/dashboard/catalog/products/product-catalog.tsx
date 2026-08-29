"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ChevronDownIcon,
  LinkSquare02Icon,
  Package01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import type { CatalogProduct, CatalogProductVariant } from "@/types/product"

type ProductCatalogProps = {
  products: CatalogProduct[]
}

export function ProductCatalog({ products }: ProductCatalogProps) {
  const [query, setQuery] = useState("")
  const [openProductIds, setOpenProductIds] = useState<Set<string>>(
    () => new Set()
  )
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR")

    if (!normalizedQuery) return products

    return products.filter((product) => {
      const searchableValues = [
        product.title,
        product.brand,
        product.category,
        ...product.variants.flatMap((variant) => [
          variant.sku,
          variant.barcode,
          variant.color,
          variant.size,
        ]),
      ]

      return searchableValues.some((value) =>
        value?.toLocaleLowerCase("tr-TR").includes(normalizedQuery)
      )
    })
  }, [products, query])
  const allVisibleProductsOpen =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => openProductIds.has(product.id))

  function setProductOpen(productId: string, open: boolean) {
    setOpenProductIds((current) => {
      const next = new Set(current)

      if (open) next.add(productId)
      else next.delete(productId)

      return next
    })
  }

  function openAllVisibleProducts() {
    setOpenProductIds((current) => {
      const next = new Set(current)
      filteredProducts.forEach((product) => next.add(product.id))
      return next
    })
  }

  function closeAllVisibleProducts() {
    setOpenProductIds((current) => {
      const next = new Set(current)
      filteredProducts.forEach((product) => next.delete(product.id))
      return next
    })
  }

  if (products.length === 0) {
    return <EmptyCatalog />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-80">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ürün, SKU, barkod, renk veya beden ara"
            className="h-9! pl-9"
            aria-label="Katalogda ara"
          />
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openAllVisibleProducts}
            disabled={allVisibleProductsOpen || filteredProducts.length === 0}
          >
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
            Tümünü aç
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={closeAllVisibleProducts}
            disabled={
              filteredProducts.length === 0 ||
              !filteredProducts.some((product) =>
                openProductIds.has(product.id)
              )
            }
          >
            <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
            Tümünü kapat
          </Button>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <NoSearchResults query={query} onClear={() => setQuery("")} />
      ) : (
        <div className="grid gap-2.5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              open={openProductIds.has(product.id)}
              onOpenChange={(open) => setProductOpen(product.id, open)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProductCard({
  product,
  open,
  onOpenChange,
}: {
  product: CatalogProduct
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const totalStock = product.variants.reduce(
    (total, variant) => total + variant.stock,
    0
  )
  const sourceNames = product.externalProducts
    .map((source) => getProviderName(source.connection.providerKey))
    .join(", ")
  const variantsContentId = `product-variants-${product.id}`

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-colors hover:border-foreground/15">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-controls={variantsContentId}
          onClick={() => onOpenChange(!open)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onOpenChange(!open)
            }
          }}
          className="flex cursor-pointer items-center gap-3 p-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:gap-4 sm:p-4"
        >
          <ProductThumbnail product={product} />

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {product.title}
              </h2>
              <Badge variant="outline" className="hidden shrink-0 sm:flex">
                {sourceNames || "Pazaryeri"}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {[product.brand, product.category].filter(Boolean).join(" · ") ||
                "Kategori bilgisi bulunmuyor"}
            </p>
            {product.description ? (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {product.description}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-2 text-xs lg:hidden">
              <span className="font-semibold text-foreground">
                {formatPriceRange(product.variants)}
              </span>
              <span className="text-border">•</span>
              <span className="text-muted-foreground">
                {product.variants.length} varyant
              </span>
              <span className="text-border">•</span>
              <span
                className={
                  totalStock > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {totalStock} stok
              </span>
            </div>
          </div>

          <div className="hidden min-w-72 grid-cols-3 gap-5 border-l border-border pl-5 lg:grid">
            <ProductSummary
              label="Fiyat"
              value={formatPriceRange(product.variants)}
            />
            <ProductSummary
              label="Varyant"
              value={String(product.variants.length)}
            />
            <ProductSummary
              label="Stok"
              value={String(totalStock)}
              tone={totalStock > 0 ? "success" : "warning"}
            />
          </div>

          <span className="flex size-9 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground sm:w-auto sm:px-3">
            <span className="hidden sm:inline">
              {open ? "Gizle" : "Varyantlar"}
            </span>
            <HugeiconsIcon
              icon={ChevronDownIcon}
              className={`size-4 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </span>
        </div>

        <CollapsibleContent id={variantsContentId}>
          <div className="border-t border-border bg-muted/15">
            <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Ürün detayları
                </p>
                {product.attributes.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {product.attributes.map((attribute) => (
                      <Badge key={attribute.id} variant="secondary">
                        {attribute.name}: {attribute.value}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Ek ürün özelliği bulunmuyor.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>Güncellendi: {formatDate(product.updatedAt)}</span>
                {product.externalProducts[0]?.externalUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={product.externalProducts[0].externalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <HugeiconsIcon
                        icon={LinkSquare02Icon}
                        className="size-3.5"
                      />
                      Pazaryerinde aç
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <VariantTable variants={product.variants} />
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}

function ProductThumbnail({ product }: { product: CatalogProduct }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = product.images[0]?.url
  const supportedImageUrl =
    imageUrl?.startsWith("/") || imageUrl?.startsWith("https://")

  return (
    <div className="relative size-18 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:size-20">
      {imageUrl && supportedImageUrl && !failed ? (
        <Image
          src={imageUrl}
          alt={product.title}
          fill
          sizes="(max-width: 639px) 72px, 80px"
          className="object-cover transition-transform duration-300 hover:scale-[1.03]"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/45 text-muted-foreground">
          <HugeiconsIcon icon={Package01Icon} className="size-7" />
          <span className="text-[10px] font-medium">Görsel yok</span>
        </div>
      )}
      {product.images.length > 1 ? (
        <span className="absolute right-2 bottom-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur">
          +{product.images.length - 1}
        </span>
      ) : null}
    </div>
  )
}

function VariantTable({ variants }: { variants: CatalogProductVariant[] }) {
  if (variants.length === 0) {
    return (
      <div className="border-t border-border px-5 py-8 text-center text-sm text-muted-foreground">
        Bu ürün için varyant bilgisi bulunmuyor.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border-t border-border bg-card">
      <table className="w-full min-w-200 text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-medium">Varyant</th>
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

function VariantRow({ variant }: { variant: CatalogProductVariant }) {
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
        <Badge
          variant={variant.stock > 0 ? "success" : "warning"}
          className="justify-center"
        >
          {variant.stock > 0 ? `${variant.stock} adet` : "Tükendi"}
        </Badge>
      </td>
    </tr>
  )
}

function ProductSummary({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "success" | "warning"
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      <p
        className={`mt-1 text-[11px] ${
          tone === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warning"
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
        }`}
      >
        {label}
      </p>
    </div>
  )
}

function EmptyCatalog() {
  return (
    <section className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center shadow-xs">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={Package01Icon} className="size-5" />
      </span>
      <h2 className="mt-5 font-semibold text-foreground">Katalog henüz boş</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Satış kanalları ekranından bir pazaryeri bağlantısını tamamlayın ve
        “Ürünleri çek” işlemini başlatın.
      </p>
    </section>
  )
}

function NoSearchResults({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <section className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
      <HugeiconsIcon
        icon={Search01Icon}
        className="size-6 text-muted-foreground"
      />
      <h2 className="mt-4 font-semibold text-foreground">Ürün bulunamadı</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        “{query}” ile eşleşen ürün veya varyant yok.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onClear}
        className="mt-4"
      >
        Aramayı temizle
      </Button>
    </section>
  )
}

function formatPriceRange(variants: CatalogProductVariant[]) {
  if (variants.length === 0) return "—"

  const prices = variants.map((variant) => variant.price)
  const minimum = Math.min(...prices)
  const maximum = Math.max(...prices)
  const currency = variants[0].currency

  if (minimum === maximum) return formatPrice(minimum, currency)

  return `${formatPrice(minimum, currency)} – ${formatPrice(maximum, currency)}`
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(price)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

function getProviderName(providerKey: string) {
  if (providerKey === "trendyol") return "Trendyol"
  if (providerKey === "hepsiburada") return "Hepsiburada"
  return providerKey
}
