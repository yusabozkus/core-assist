import { Package01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

export function EmptyCatalog({ canManageStore }: { canManageStore: boolean }) {
  return (
    <section className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center shadow-xs">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={Package01Icon} className="size-5" />
      </span>
      <h2 className="mt-5 font-semibold text-foreground">Katalog henüz boş</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {canManageStore
          ? "Satış kanalları ekranından bir pazaryeri bağlantısını tamamlayın ve ürünleri çekin."
          : "Mağaza kataloğuna henüz ürün aktarılmadı."}
      </p>
    </section>
  )
}
