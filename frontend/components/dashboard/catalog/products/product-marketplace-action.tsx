"use client"

import { ArrowDown01Icon, LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CatalogProduct } from "@/types/product"

type MarketplaceSource = CatalogProduct["externalProducts"][number]

export function ProductMarketplaceAction({
  sources,
}: {
  sources: MarketplaceSource[]
}) {
  const availableSources = sources.filter(
    (source): source is MarketplaceSource & { externalUrl: string } =>
      Boolean(source.externalUrl)
  )

  if (availableSources.length === 0) return null

  if (availableSources.length === 1) {
    const source = availableSources[0]

    return (
      <Button asChild size="sm" variant="outline" className="h-8 bg-background">
        <a href={source.externalUrl} target="_blank" rel="noreferrer">
          <MarketplaceLogo provider={source.connection.providerKey} />
          <span className="hidden sm:inline">Pazaryerinde aç</span>
          <span className="sm:hidden">Aç</span>
          <HugeiconsIcon icon={LinkSquare02Icon} className="size-3.5" />
        </a>
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 bg-background">
          <span>Pazaryerinde aç</span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {availableSources.map((source) => (
          <DropdownMenuItem
            key={`${source.connection.providerKey}-${source.externalId}`}
            asChild
          >
            <a href={source.externalUrl} target="_blank" rel="noreferrer">
              <MarketplaceLogo provider={source.connection.providerKey} />
              <span className="min-w-0 flex-1 truncate">
                {getProviderName(source.connection.providerKey)}
              </span>
              <HugeiconsIcon
                icon={LinkSquare02Icon}
                className="size-3.5 text-muted-foreground"
              />
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
