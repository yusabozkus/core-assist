import Link from "next/link"
import {
  AiSparklesIcon,
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"
import type {
  AdminAiBlockerItem,
  AdminAiBlockerList,
} from "@/types/admin-ai-usage"

export function AdminAiBlockerListView({
  data,
}: {
  data: AdminAiBlockerList
}) {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10">
      <Link
        href={APP_ROUTES.admin.aiUsage}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        AI ve kullanıma dön
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            İşlem engeli
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            {data.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {data.description}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Açık kayıt
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {data.total.toLocaleString("tr-TR")}
          </p>
        </div>
      </div>

      <section className="mt-7 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-sm font-semibold">İlgili kayıtlar</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              En son güncellenen kayıtlar önce gösterilir.
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Son kontrol · {formatDate(data.generatedAt)}
          </p>
        </div>

        {data.items.length ? (
          <div className="divide-y divide-border">
            {data.items.map((item) => (
              <BlockerRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <HugeiconsIcon
                icon={CheckmarkCircle01Icon}
                className="size-5"
              />
            </span>
            <p className="mt-4 text-sm font-semibold">Açık kayıt bulunmuyor</p>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
              Bu kategoride şu anda yönetici müdahalesi gerektiren bir işlem
              yok.
            </p>
          </div>
        )}

        {data.pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 sm:px-6">
            <p className="text-xs text-muted-foreground">
              Sayfa {data.pagination.page} / {data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <PaginationButton
                href={pageHref(data, data.pagination.page - 1)}
                disabled={data.pagination.page <= 1}
                direction="previous"
              />
              <PaginationButton
                href={pageHref(data, data.pagination.page + 1)}
                disabled={
                  data.pagination.page >= data.pagination.totalPages
                }
                direction="next"
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

function BlockerRow({ item }: { item: AdminAiBlockerItem }) {
  return (
    <article className="px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3.5">
          <span
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
              item.error
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/8 text-primary"
            )}
          >
            <HugeiconsIcon
              icon={
                item.kind === "KNOWLEDGE"
                  ? AiSparklesIcon
                  : AlertCircleIcon
              }
              className="size-4"
            />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <Badge
                variant="outline"
                className="border-border bg-muted/55 px-2 py-0 text-[9px] text-muted-foreground"
              >
                {statusLabel(item.status)}
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-foreground/80">
              {item.description}
            </p>
          </div>
        </div>
        <time className="shrink-0 text-[10px] text-muted-foreground">
          {formatDate(item.occurredAt)}
        </time>
      </div>

      {item.error ? (
        <div className="mt-4 rounded-lg border border-destructive/15 bg-destructive/5 px-3.5 py-3 text-[11px] leading-5 text-destructive lg:ml-[50px]">
          <span className="font-semibold">Neden: </span>
          {item.error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col justify-between gap-3 border-t border-border/70 pt-3 lg:ml-[50px] lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={Store01Icon} className="size-3.5" />
            {item.store.name}
          </span>
          <Link
            href={APP_ROUTES.admin.customer(item.store.account.id)}
            className="font-medium text-foreground/75 transition-colors hover:text-primary hover:underline"
          >
            Müşteri hesabı: {item.store.account.name}
          </Link>
          <span>
            {item.store.account.owner.name} · {item.store.account.owner.email}
          </span>
          {item.metadata.map((entry) => (
            <span key={`${entry.label}-${entry.value}`}>
              {entry.label}: {metadataValue(entry.value)}
            </span>
          ))}
        </div>
        <div className="flex min-w-0 flex-wrap gap-2 text-[9px] text-muted-foreground">
          {item.externalQuestionId ? (
            <code className="max-w-56 truncate rounded-md bg-muted px-2 py-1">
              Soru: {item.externalQuestionId}
            </code>
          ) : null}
          <code className="max-w-56 truncate rounded-md bg-muted px-2 py-1">
            Kayıt: {item.id}
          </code>
        </div>
      </div>
    </article>
  )
}

function PaginationButton({
  href,
  disabled,
  direction,
}: {
  href: string
  disabled: boolean
  direction: "previous" | "next"
}) {
  const previous = direction === "previous"
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      aria-disabled={disabled}
      className={cn(disabled && "pointer-events-none opacity-50")}
    >
      <Link href={href}>
        {previous ? (
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        ) : null}
        {previous ? "Önceki" : "Sonraki"}
        {!previous ? (
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
        ) : null}
      </Link>
    </Button>
  )
}

function pageHref(data: AdminAiBlockerList, page: number) {
  return `${APP_ROUTES.admin.aiUsageBlocker(data.type)}?page=${Math.max(1, page)}`
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    FAILED: "Başarısız",
    REVIEW_REQUIRED: "Teslimat kontrolü gerekli",
    BLOCKED_QUOTA: "Kota bekliyor",
    BLOCKED_SUBSCRIPTION: "Abonelik bekliyor",
    DRAFTED: "Taslak hazır",
    NEEDS_REVIEW: "İnceleme bekliyor",
    CONFLICT: "Çakışma",
  }
  return labels[value] ?? value
}

function metadataValue(value: string) {
  const values: Record<string, string> = {
    AUTOMATION: "Otomasyon",
    MANUAL: "Manuel",
    AI_UNCHANGED: "AI · değiştirilmedi",
    AI_EDITED: "AI · düzenlendi",
    FIT: "Beden ve kalıp",
    CARE: "Bakım",
    PRODUCT_INFO: "Ürün bilgisi",
  }
  return values[value] ?? value
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
