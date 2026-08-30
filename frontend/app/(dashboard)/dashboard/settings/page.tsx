import { redirect } from "next/navigation"
import {
  Archive02Icon,
  Delete02Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { APP_ROUTES } from "@/constants/site"
import { getActiveStoreContext } from "@/lib/stores/active-store"
import { StoreArchiveAction } from "./store-archive-action"
import { StoreDeleteAction } from "./store-delete-action"
import { StoreRestoreAction } from "./store-restore-action"

export const dynamic = "force-dynamic"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

export default async function SettingsPage() {
  const { activeStore } = await getActiveStoreContext()

  if (!activeStore) {
    redirect(APP_ROUTES.onboarding)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <HugeiconsIcon icon={Store01Icon} className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Seçili mağaza
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-[-0.025em] text-foreground">
                {activeStore.name}
              </h1>
            </div>
          </div>

          <Badge
            variant={activeStore.status === "ACTIVE" ? "success" : "warning"}
            className="w-fit"
          >
            <span className="size-1.5 rounded-full bg-current" />
            {activeStore.status === "ACTIVE" ? "Aktif" : "Arşivlenmiş"}
          </Badge>
        </div>

        <dl className="grid border-t border-border sm:grid-cols-2">
          <StoreMeta
            label="Oluşturulma tarihi"
            value={dateFormatter.format(new Date(activeStore.createdAt))}
          />
          <StoreMeta label="Mağaza kimliği" value={activeStore.id} mono />
        </dl>
      </section>

      <div className="mt-6 grid gap-4">
        {activeStore.status === "ACTIVE" ? (
          <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <HugeiconsIcon icon={Archive02Icon} className="size-4.5" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">
                  Mağazayı arşivle
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Mağazayı geçici olarak kullanımdan kaldırır. Kanal
                  senkronizasyonları durdurulur ve mağaza yalnızca ayarlar
                  sayfasından yönetilebilir.
                </p>
              </div>
            </div>
            <StoreArchiveAction
              storeId={activeStore.id}
              storeName={activeStore.name}
            />
          </section>
        ) : (
          <section className="flex flex-col gap-5 rounded-xl border border-primary/25 bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HugeiconsIcon icon={Archive02Icon} className="size-4.5" />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">
                  Mağazayı geri yükle
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Mağazayı yeniden kullanıma açar. Operasyon sayfaları tekrar
                  erişilebilir olur ve kanal senkronizasyonları devam eder.
                </p>
              </div>
            </div>
            <StoreRestoreAction
              storeId={activeStore.id}
              storeName={activeStore.name}
            />
          </section>
        )}

        <section className="flex flex-col gap-5 rounded-xl border border-destructive/35 bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <HugeiconsIcon icon={Delete02Icon} className="size-4.5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground">
                  Mağazayı kalıcı olarak sil
                </h2>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
                Mağaza ile birlikte bağlı kanalların, ürünlerin ve soru
                kayıtlarının silinmesini başlatır. Bu işlem geri alınamaz.
              </p>
            </div>
          </div>
          <StoreDeleteAction
            storeId={activeStore.id}
            storeName={activeStore.name}
          />
        </section>
      </div>
    </div>
  )
}

function StoreMeta({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 px-5 py-4 sm:px-6 sm:[&:not(:last-child)]:border-r sm:[&:not(:last-child)]:border-border">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 truncate text-sm font-medium text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}
