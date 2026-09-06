import {
  GridTableIcon,
  GridViewIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ProviderLogo } from "@/components/dashboard/channels/provider-logo"
import type { ProductCatalogView } from "@/constants/catalog"
import { cn } from "@/lib/utils"

type CatalogToolbarProps = {
  query: string
  onQueryChange: (query: string) => void
  provider: string
  onProviderChange: (provider: string) => void
  providers: Array<{ key: string; name: string }>
  view: ProductCatalogView | null
  onViewChange: (view: ProductCatalogView) => void
  shown: number
  total: number
  isLoading: boolean
}

const views = [
  {
    value: "standard",
    label: "Standart",
    description: "Büyük görsellerle ürünleri inceleyin",
    icon: GridViewIcon,
  },
  {
    value: "compact",
    label: "Kompakt",
    description: "Aynı ekranda daha fazla ürün görün",
    icon: GridTableIcon,
  },
] as const

export function CatalogToolbar({
  query,
  onQueryChange,
  provider,
  onProviderChange,
  providers,
  view,
  onViewChange,
  shown,
  total,
  isLoading,
}: CatalogToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl">
          <div className="min-w-0 flex-1">
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Ürün adı, SKU, barkod veya özellik ara"
              icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
              className="h-10! border-border bg-card"
              aria-label="Katalogda ara"
              maxLength={100}
            />
          </div>
          <Select value={provider} onValueChange={onProviderChange}>
            <SelectTrigger
              className="h-10! w-full shrink-0 border-border bg-card sm:w-48"
              aria-label="Pazaryerine göre filtrele"
            >
              <SelectValue placeholder="Tüm pazaryerleri" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="ALL">Tüm pazaryerleri</SelectItem>
              {providers.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  <ProviderLogo
                    provider={item.key}
                    sizes="20px"
                    className="size-5 rounded shadow-none"
                  />
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          role="group"
          aria-label="Ürün görünümü"
          className="inline-flex w-fit shrink-0 items-center gap-1 rounded-xl border border-border bg-card p-1"
        >
          {views.map((option) => (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={view === option.value}
                  onClick={() => onViewChange(option.value)}
                  className={cn(
                    "h-8 gap-2 px-3 text-xs",
                    view === option.value
                      ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <HugeiconsIcon icon={option.icon} className="size-4" />
                  {option.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>
                {option.description}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p aria-live="polite" className="tabular-nums">
          {isLoading ? (
            "Ürünler güncelleniyor..."
          ) : (
            <>
              <span className="font-medium text-foreground">
                {shown.toLocaleString("tr-TR")}
              </span>{" "}
              / {total.toLocaleString("tr-TR")} ürün gösteriliyor
            </>
          )}
        </p>
        {query || provider !== "ALL" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => {
              onQueryChange("")
              onProviderChange("ALL")
            }}
          >
            Filtreleri temizle
          </Button>
        ) : null}
      </div>
    </div>
  )
}
