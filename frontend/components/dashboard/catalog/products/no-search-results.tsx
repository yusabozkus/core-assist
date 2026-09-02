import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

type NoSearchResultsProps = {
  query: string
  providerName?: string
  onClear: () => void
}

export function NoSearchResults({
  query,
  providerName,
  onClear,
}: NoSearchResultsProps) {
  const description = query
    ? `“${query}” ile eşleşen ürün, varyant veya özellik yok.`
    : `${providerName ?? "Seçilen pazaryeri"} kanalında gösterilecek ürün bulunamadı.`

  return (
    <section className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
      <HugeiconsIcon
        icon={Search01Icon}
        className="size-6 text-muted-foreground"
      />
      <h2 className="mt-4 font-semibold text-foreground">Ürün bulunamadı</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onClear}
        className="mt-4"
      >
        Filtreleri temizle
      </Button>
    </section>
  )
}
