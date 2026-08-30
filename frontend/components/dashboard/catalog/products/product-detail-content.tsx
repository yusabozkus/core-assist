"use client"

import { useState } from "react"
import Image from "next/image"
import { LinkSquare02Icon, Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  formatCatalogDate,
  formatPriceRange,
  getProviderName,
} from "@/components/dashboard/catalog/products/product-catalog-utils"
import { VariantTable } from "@/components/dashboard/catalog/products/variant-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CatalogProduct } from "@/types/product"

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

function ProductGallery({ product }: { product: CatalogProduct }) {
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set())
  const primaryImage = product.images.find(
    (image) => !failedImages.has(image.id)
  )

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-muted">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={product.title}
            fill
            sizes="(max-width: 767px) 100vw, 240px"
            className="object-cover"
            onError={() =>
              setFailedImages((current) =>
                new Set(current).add(primaryImage.id)
              )
            }
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <HugeiconsIcon icon={Package01Icon} className="size-9" />
            <span className="text-xs font-medium">Görsel bulunmuyor</span>
          </div>
        )}
      </div>
      {product.images.length > 1 ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {product.images.length} ürün görseli
        </p>
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
