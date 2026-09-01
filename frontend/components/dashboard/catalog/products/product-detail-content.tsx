"use client"

import { useState } from "react"
import Image from "next/image"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  LinkSquare02Icon,
  Package01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  formatCatalogDate,
  formatPriceRange,
  getProviderName,
} from "@/components/dashboard/catalog/products/product-catalog-utils"
import { VariantTable } from "@/components/dashboard/catalog/products/variant-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CatalogProduct, CatalogSizeGuide } from "@/types/product"

export function ProductDetailContent({ product }: { product: CatalogProduct }) {
  const totalStock = product.variants.reduce(
    (total, variant) => total + variant.stock,
    0
  )

  return (
    <div className="divide-y divide-border">
      <section className="grid gap-6 px-5 py-6 md:grid-cols-[15rem_minmax(0,1fr)] md:px-6">
        <ProductGallery product={product} />
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            {product.externalProducts.map((source) => (
              <Badge
                key={`${source.connection.providerKey}-${source.externalId}`}
                variant="outline"
                className="bg-background"
              >
                {getProviderName(source.connection.providerKey)}
              </Badge>
            ))}
            <Badge variant={totalStock > 0 ? "success" : "warning"}>
              {totalStock > 0 ? "Satışta" : "Stokta yok"}
            </Badge>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
            <DetailStat
              label="Fiyat aralığı"
              value={formatPriceRange(product.variants)}
            />
            <DetailStat label="Toplam stok" value={`${totalStock} adet`} />
            <DetailStat
              label="Varyant"
              value={product.variants.length.toLocaleString("tr-TR")}
            />
            <DetailStat
              label="Güncellendi"
              value={formatCatalogDate(product.updatedAt)}
            />
          </dl>

          {product.description ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-foreground">
                Ürün açıklaması
              </h3>
              <p className="mt-2 text-sm leading-6 whitespace-pre-line text-muted-foreground">
                {product.description}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-5 py-6 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">
            Ürün özellikleri
          </h3>
          <span className="text-xs text-muted-foreground">
            {product.attributes.length} özellik
          </span>
        </div>
        {product.attributes.length > 0 ? (
          <dl className="mt-4 grid overflow-hidden rounded-xl border border-border sm:grid-cols-2">
            {product.attributes.map((attribute) => (
              <div
                key={attribute.id}
                className="grid grid-cols-[minmax(7rem,0.7fr)_minmax(0,1.3fr)] gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <dt className="text-xs font-medium text-muted-foreground">
                  {attribute.name}
                </dt>
                <dd className="text-sm leading-5 font-medium text-foreground">
                  {attribute.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Bu ürün için ek özellik bulunmuyor.
          </p>
        )}
      </section>

      <SizeGuideSection guides={product.sizeGuides} />

      <section className="py-6">
        <div className="flex items-center justify-between gap-4 px-5 pb-4 md:px-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Varyantlar
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Renk, beden, fiyat ve güncel stok bilgileri
            </p>
          </div>
          <Badge variant="secondary">{product.variants.length} varyant</Badge>
        </div>
        <VariantTable variants={product.variants} />
      </section>

      <section className="px-5 py-6 md:px-6">
        <h3 className="text-sm font-semibold text-foreground">
          Pazaryeri kayıtları
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {product.externalProducts.map((source) => (
            <div
              key={`${source.connection.providerKey}-${source.externalId}`}
              className="rounded-xl border border-border bg-muted/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {getProviderName(source.connection.providerKey)}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {source.externalId}
                  </p>
                </div>
                <Badge variant="outline">{source.status}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatCatalogDate(source.lastSyncedAt)}
                </span>
                {source.externalUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={source.externalUrl}
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
          ))}
        </div>
      </section>
    </div>
  )
}

function SizeGuideSection({ guides = [] }: { guides?: CatalogSizeGuide[] }) {
  if (guides.length === 0) return null

  const guide =
    guides.find((candidate) => candidate.status === "READY") ?? guides[0]
  const data = guide.structuredData
  const statusLabel = {
    PENDING: "Analiz bekliyor",
    PROCESSING: "Analiz ediliyor",
    READY: "Hazır",
    FAILED: "Analiz edilemedi",
  }[guide.status]

  return (
    <section className="px-5 py-6 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Beden tablosu
            </h3>
            <Badge variant={guide.status === "READY" ? "success" : "secondary"}>
              {statusLabel}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pazaryerindeki beden tablosundan alınan ölçüler
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={guide.sourceUrl} target="_blank" rel="noreferrer">
            <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
            Orijinal tablo
          </a>
        </Button>
      </div>

      {guide.status === "READY" && data?.rows.length ? (
        <div className="mt-4 space-y-3">
          <div className="themed-scrollbar overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Beden</th>
                  {data.headers.map((header) => (
                    <th key={header} className="px-4 py-3 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.rows.map((row) => (
                  <tr key={row.label} className="bg-card">
                    <th className="px-4 py-3 font-semibold text-foreground">
                      {row.label}
                    </th>
                    {data.headers.map((header) => (
                      <td
                        key={`${row.label}-${header}`}
                        className="px-4 py-3 text-muted-foreground"
                      >
                        {row.measurements.find(
                          (measurement) => measurement.name === header
                        )?.value ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.notes.length ? (
            <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
              {data.notes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {guide.status === "FAILED"
            ? "Beden tablosu otomatik olarak okunamadı. Orijinal tabloyu kontrol edebilirsiniz."
            : "Beden tablosu arka planda hazırlanıyor. Analiz tamamlandığında ölçüler burada görünecek."}
        </p>
      )}
    </section>
  )
}

function ProductGallery({ product }: { product: CatalogProduct }) {
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set())
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const availableImages = product.images.filter(
    (image) => !failedImages.has(image.id)
  )
  const primaryImage =
    availableImages.find((image) => image.id === selectedImageId) ??
    availableImages[0]
  const selectedImageIndex = primaryImage
    ? availableImages.findIndex((image) => image.id === primaryImage.id)
    : -1

  function showRelativeImage(direction: -1 | 1) {
    if (availableImages.length < 2) return

    const nextIndex =
      (selectedImageIndex + direction + availableImages.length) %
      availableImages.length
    setSelectedImageId(availableImages[nextIndex].id)
  }

  return (
    <div>
      <div className="relative aspect-[4/5] rounded-xl border border-border bg-muted">
        {primaryImage ? (
          <>
            <Image
              src={primaryImage.url}
              alt={`${product.title} - ${selectedImageIndex + 1}. görsel`}
              fill
              sizes="(max-width: 767px) 100vw, 240px"
              className="rounded-xl object-cover"
              onError={() =>
                setFailedImages((current) =>
                  new Set(current).add(primaryImage.id)
                )
              }
            />

            {availableImages.length > 1 ? (
              <>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  className="absolute top-1/2 -left-5 hidden size-9 -translate-y-1/2 rounded-full border border-border/80 bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background md:flex"
                  aria-label="Önceki ürün görseli"
                  onClick={() => showRelativeImage(-1)}
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    className="size-4"
                    strokeWidth={2}
                  />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  className="absolute top-1/2 -right-5 hidden size-9 -translate-y-1/2 rounded-full border border-border/80 bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background md:flex"
                  aria-label="Sonraki ürün görseli"
                  onClick={() => showRelativeImage(1)}
                >
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className="size-4"
                    strokeWidth={2}
                  />
                </Button>
                <span className="absolute right-3 bottom-3 rounded-full border border-border/70 bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground tabular-nums shadow-sm backdrop-blur-sm">
                  {selectedImageIndex + 1} / {availableImages.length}
                </span>
              </>
            ) : null}
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <HugeiconsIcon icon={Package01Icon} className="size-9" />
            <span className="text-xs font-medium">Görsel bulunmuyor</span>
          </div>
        )}
      </div>
      {availableImages.length > 1 ? (
        <div
          className="themed-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1"
          aria-label="Ürün görselleri"
        >
          {availableImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted transition-colors hover:border-foreground/40 data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/20"
              data-active={image.id === primaryImage?.id}
              aria-label={`${index + 1}. ürün görselini göster`}
              aria-pressed={image.id === primaryImage?.id}
              onClick={() => setSelectedImageId(image.id)}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
                onError={() =>
                  setFailedImages((current) => new Set(current).add(image.id))
                }
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l-2 border-border pl-3">
      <dt className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  )
}
