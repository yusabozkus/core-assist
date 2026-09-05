import Link from "next/link"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  InboxIcon,
  Package01Icon,
  PlugSocketIcon,
  Settings02Icon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { APP_ROUTES } from "@/constants/site"
import type { AuthUser } from "@/types/auth"
import type { StoreSummary } from "@/types/store"

type DashboardSnapshot = {
  questions: { total: number; pending: number; answered: number }
  catalog: { products: number; variants: number; totalStock: number }
  inventory: { lowStock: number; outOfStock: number }
  channels: { connected: number; issues: number }
}

export function DashboardClient({
  user,
  activeStore,
  snapshot,
}: {
  user: AuthUser | null
  activeStore: StoreSummary
  snapshot: DashboardSnapshot
}) {
  const attentionCount =
    snapshot.questions.pending +
    snapshot.inventory.lowStock +
    snapshot.inventory.outOfStock +
    snapshot.channels.issues

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">{activeStore.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            Hoş geldiniz{user?.name ? `, ${firstName(user.name)}` : ""}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Mağazanızdaki güncel operasyonları ve ilgilenmeniz gereken alanları
            tek bakışta görün.
          </p>
        </div>
        <Badge
          variant={attentionCount > 0 ? "warning" : "success"}
          className="w-fit"
        >
          <span className="size-1.5 rounded-full bg-current" />
          {attentionCount > 0
            ? `${attentionCount.toLocaleString("tr-TR")} kayıt ilgi bekliyor`
            : "Tüm işlemler güncel"}
        </Badge>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewMetric
          icon={InboxIcon}
          label="Bekleyen sorular"
          value={snapshot.questions.pending}
          helper={`${snapshot.questions.total.toLocaleString("tr-TR")} toplam soru`}
          href={APP_ROUTES.dashboard.inbox}
          tone="amber"
        />
        <OverviewMetric
          icon={CheckmarkCircle01Icon}
          label="Yanıtlanan"
          value={snapshot.questions.answered}
          helper="Müşteriye gönderilen cevaplar"
          href={`${APP_ROUTES.dashboard.inbox}?status=ANSWERED`}
          tone="emerald"
        />
        <OverviewMetric
          icon={Package01Icon}
          label="Katalogdaki ürün"
          value={snapshot.catalog.products}
          helper={`${snapshot.catalog.variants.toLocaleString("tr-TR")} varyant`}
          href={APP_ROUTES.dashboard.catalog.products}
          tone="blue"
        />
        <OverviewMetric
          icon={PlugSocketIcon}
          label="Bağlı kanal"
          value={snapshot.channels.connected}
          helper={
            snapshot.channels.issues > 0
              ? `${snapshot.channels.issues} bağlantı kontrol edilmeli`
              : "Bağlantılar çalışıyor"
          }
          href={APP_ROUTES.dashboard.channels.root}
          tone="violet"
        />
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <header className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-semibold tracking-[-0.02em]">
              Operasyon görünümü
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Katalog ve stok tarafındaki güncel özet.
            </p>
          </header>
          <div className="divide-y divide-border">
            <OperationRow
              label="Toplam stok"
              description="Aktif ürün varyantlarındaki toplam adet"
              value={`${snapshot.catalog.totalStock.toLocaleString("tr-TR")} adet`}
            />
            <OperationRow
              label="Azalan stok"
              description="Belirlenen kritik stok eşiğinin altındaki varyantlar"
              value={snapshot.inventory.lowStock.toLocaleString("tr-TR")}
              warning={snapshot.inventory.lowStock > 0}
            />
            <OperationRow
              label="Tükenen stok"
              description="Satışa açık fakat stoğu kalmayan varyantlar"
              value={snapshot.inventory.outOfStock.toLocaleString("tr-TR")}
              destructive={snapshot.inventory.outOfStock > 0}
            />
          </div>
          <div className="border-t border-border px-5 py-3.5 sm:px-6">
            <Link
              href={APP_ROUTES.dashboard.catalog.inventory}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Stok takibini aç
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="font-semibold tracking-[-0.02em]">Hızlı işlemler</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            En sık kullanılan alanlara doğrudan geçin.
          </p>
          <div className="mt-4 space-y-2">
            <QuickLink
              icon={InboxIcon}
              title="Soruları yanıtla"
              description="Bekleyen müşteri sorularını inceleyin"
              href={APP_ROUTES.dashboard.inbox}
            />
            <QuickLink
              icon={ShoppingBag01Icon}
              title="Ürünleri incele"
              description="Katalog ve ürün detaylarını görüntüleyin"
              href={APP_ROUTES.dashboard.catalog.products}
            />
            <QuickLink
              icon={Settings02Icon}
              title="Yanıt ayarları"
              description="AI davranışını ve otomasyonu yönetin"
              href={APP_ROUTES.dashboard.automations.root}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function OverviewMetric({
  icon,
  label,
  value,
  helper,
  href,
  tone,
}: {
  icon: IconSvgElement
  label: string
  value: number
  helper: string
  href: string
  tone: "amber" | "emerald" | "blue" | "violet"
}) {
  const tones = {
    amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  }

  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:bg-muted/25 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <span
          className={`flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}
        >
          <HugeiconsIcon icon={icon} className="size-4" />
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-foreground tabular-nums">
        {value.toLocaleString("tr-TR")}
      </p>
      <p className="mt-1 text-xs font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
    </Link>
  )
}

function OperationRow({
  label,
  description,
  value,
  warning = false,
  destructive = false,
}: {
  label: string
  description: string
  value: string
  warning?: boolean
  destructive?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-5 px-5 py-4 sm:px-6">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${
          destructive
            ? "text-destructive"
            : warning
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function QuickLink({
  icon,
  title,
  description,
  href,
}: {
  icon: IconSvgElement
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/35"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  )
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0]
}
