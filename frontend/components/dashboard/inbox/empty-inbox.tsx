import { InboxIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

type EmptyInboxProps = { onSync: () => void; isSyncing: boolean }

export function EmptyInbox({ onSync, isSyncing }: EmptyInboxProps) {
  return (
    <section className="flex min-h-96 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center shadow-xs">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <HugeiconsIcon icon={InboxIcon} className="size-5" />
      </span>
      <h2 className="mt-5 font-semibold text-foreground">
        Henüz ürün sorusu bulunmuyor
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Bağlı pazaryerlerindeki yeni ürün sorularını kontrol ederek gelen
        kutusuna aktarabilirsiniz.
      </p>
      <Button
        type="button"
        className="mt-5"
        onClick={onSync}
        disabled={isSyncing}
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          className={`size-4 ${isSyncing ? "animate-spin" : ""}`}
        />
        {isSyncing ? "Kontrol ediliyor..." : "Soruları kontrol et"}
      </Button>
    </section>
  )
}
