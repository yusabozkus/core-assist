"use client"

import { LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Button } from "@/components/ui/button"
import type { CatalogProduct } from "@/types/product"

type MarketplaceSource = CatalogProduct["externalProducts"][number]
type AvailableMarketplaceSource = MarketplaceSource & { externalUrl: string }

export function ProductMarketplaceAction({
  sources,
}: {
  sources: MarketplaceSource[]
}) {
  const availableSources = getAvailableSources(sources)

  if (availableSources.length === 0) return null

  return (
    <div className="flex items-center gap-1.5">
      {availableSources.map((source) => {
        const providerName = getProviderName(source.connection.providerKey)

        return (
          <Button
            key={`${source.connection.providerKey}-${source.externalId}`}
            asChild
            size="sm"
            variant="outline"
            className="h-8 bg-background px-2.5"
          >
            <a
              href={source.externalUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${providerName} pazaryerinde aç`}
            >
              <MarketplaceLogo provider={source.connection.providerKey} />
              <span className="hidden lg:inline">
                {providerName}&apos;da aç
              </span>
              <HugeiconsIcon
                icon={LinkSquare02Icon}
                className="hidden size-3.5 text-muted-foreground sm:block"
              />
            </a>
          </Button>
        )
      })}
    </div>
  )
}

function getAvailableSources(sources: MarketplaceSource[]) {
  const byProvider = new Map<string, AvailableMarketplaceSource>()

  for (const source of sources) {
    if (!source.externalUrl) continue

    const provider = source.connection.providerKey
    const current = byProvider.get(provider)
    const sourceIsPreferred =
      !current ||
      (source.status === "ACTIVE" && current.status !== "ACTIVE") ||
      (source.status === current.status &&
        new Date(source.lastSyncedAt).getTime() >
          new Date(current.lastSyncedAt).getTime())

    if (sourceIsPreferred) {
      byProvider.set(provider, {
        ...source,
        externalUrl: source.externalUrl,
      })
    }
  }

  const order = ["trendyol", "hepsiburada"]

  return [...byProvider.values()].sort((left, right) => {
    const leftIndex = order.indexOf(left.connection.providerKey)
    const rightIndex = order.indexOf(right.connection.providerKey)

    if (leftIndex === -1 && rightIndex === -1) {
      return left.connection.providerKey.localeCompare(
        right.connection.providerKey,
        "tr-TR"
      )
    }
    if (leftIndex === -1) return 1
    if (rightIndex === -1) return -1
    return leftIndex - rightIndex
  })
}

function MarketplaceLogo({ provider }: { provider: string }) {
  return (
    <ProviderLogo
      provider={provider}
      className="size-4 rounded-sm border-0 shadow-none"
      sizes="16px"
    />
  )
}
