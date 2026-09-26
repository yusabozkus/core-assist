"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Mail01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { APP_ROUTES } from "@/constants/site"
import type {
  AdminEmailList as EmailList,
  AdminEmailQuery,
  EmailDeliveryStatus,
  EmailSendStatus,
} from "@/types/admin-email"
import { AdminEmailRefresh } from "./admin-email-refresh"
import {
  EMAIL_DELIVERY_STATUS,
  EMAIL_SEND_STATUS,
  EmailStatusBadges,
  emailTypeLabel,
  formatEmailDate,
} from "./admin-email-presentation"

export function AdminEmailList({
  data,
  query,
}: {
  data: EmailList
  query: AdminEmailQuery
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(query.q ?? "")
  const [from, setFrom] = useState(
    query.from ? dateInput(new Date(query.from)) : ""
  )
  const [to, setTo] = useState(
    query.to ? dateInput(new Date(new Date(query.to).getTime() - 1)) : ""
  )
  const [dateError, setDateError] = useState("")

  function navigate(changes: Partial<AdminEmailQuery>) {
    const next = { ...query, ...changes, page: changes.page ?? 1 }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(next))
      if (value !== undefined && value !== "") params.set(key, String(value))
    startTransition(() =>
      router.replace(`${APP_ROUTES.admin.emails}?${params}`)
    )
  }

  const cards = [
    {
      label: "Resend kabul etti",
      value: data.summary.sent,
      note: "Son 24 saat",
    },
    {
      label: "Teslim edildi",
      value: data.summary.delivered,
      note: "Alıcı sunucusuna · Son 24 saat",
    },
    {
      label: "Bekleyen",
      value: data.summary.pending,
      note: "Tüm açık gönderimler",
    },
    {
      label: "Başarısız / geri dönen",
      value: data.summary.failed,
      note: "Spam ve engeller dahil · Son 24 saat",
    },
    {
      label: "İnceleme gereken",
      value: data.summary.reviewRequired,
      note: "Sonucu belirsiz gönderimler",
    },
  ]
  const filtered = Boolean(
    query.q ||
    query.status ||
    query.deliveryStatus ||
    query.from ||
    query.to ||
    query.storeId ||
    query.announcementId
  )

  return (
    <main
      className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10"
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            İletişim ve teslimat
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            E-posta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gönderimleri, teslimat sonuçlarını ve müdahale gerektiren hataları
            takip edin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={APP_ROUTES.admin.announcements}>Duyuru oluştur</Link>
          </Button>
          <AdminEmailRefresh />
        </div>
      </div>

      {data.workspace ? (
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <Link
            className="font-medium hover:underline"
            href={APP_ROUTES.admin.customer(data.workspace.id)}
          >
            {data.workspace.name}
          </Link>
          <span className="text-muted-foreground">
            müşteri hesabının e-postaları
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate({ workspaceId: undefined, storeId: undefined })
            }
          >
            Tüm müşteriler
          </Button>
        </div>
      ) : null}

      <section
        aria-label="E-posta özeti"
        className="mt-7 grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-5"
      >
        {cards.map((card, index) => (
          <div
            key={card.label}
            className="border-border p-4 sm:p-5 lg:border-r last:lg:border-r-0"
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${index >= 3 && card.value ? "text-amber-600 dark:text-amber-400" : ""}`}
            >
              {card.value.toLocaleString("tr-TR")}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {card.note}
            </p>
          </div>
        ))}
      </section>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Özet,{" "}
        {query.announcementId
          ? "seçili duyuruyu"
          : query.storeId
            ? "seçili mağazayı"
            : data.workspace
              ? "bu müşteri hesabını"
              : "tüm müşterileri"}{" "}
        kapsar; aşağıdaki liste filtrelerinden bağımsızdır.
      </p>

      <section
        aria-label="E-posta sistem durumu"
        className="mt-5 grid gap-3 md:grid-cols-3"
      >
        <Health
          label="Gönderim yapılandırması"
          ok={data.health.sendingConfigured}
          value={
            data.health.sendingConfigured
              ? "API ve gönderici tanımlı"
              : "Yapılandırma eksik"
          }
          note={data.health.senderEmail ?? "Gönderici adresi tanımlanmamış."}
        />
        <Health
          label="Teslimat takibi"
          ok={data.health.trackingConfigured}
          value={
            data.health.trackingConfigured
              ? "Takip anahtarı tanımlı"
              : "Teslimat takibi kurulmamış"
          }
          note={
            data.health.lastWebhookAt
              ? `Son bildirim: ${formatEmailDate(data.health.lastWebhookAt)}`
              : "Henüz teslimat bildirimi alınmadı."
          }
        />
        <Health
          label="Bekleyen gönderimler"
          ok={data.health.overdue === 0}
          value={
            data.health.overdue
              ? `${data.health.overdue} gönderimin denemesi gecikmiş`
              : "Gecikmiş deneme yok"
          }
          note={
            data.health.oldestPendingAt
              ? `En eski bekleyen: ${formatEmailDate(data.health.oldestPendingAt)}`
              : "Bekleyen gönderim bulunmuyor."
          }
        />
      </section>

      <section className="mt-6" aria-label="Gönderim geçmişi">
        <div className="rounded-xl border border-border bg-card p-3">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (from && to && from > to) {
                setDateError("Bitiş tarihi başlangıç tarihinden önce olamaz.")
                return
              }
              setDateError("")
              navigate({
                q: search.trim() || undefined,
                from: from ? `${from}T00:00:00+03:00` : undefined,
                to: to
                  ? new Date(
                      new Date(`${to}T00:00:00+03:00`).getTime() + 86400000
                    ).toISOString()
                  : undefined,
              })
            }}
            className="space-y-3"
          >
            <div className="flex gap-2">
              <Input
                aria-label="E-postalarda ara"
                maxLength={120}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Alıcı, konu, müşteri veya mağaza ara..."
                icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
                className="h-10 bg-background shadow-none"
              />
              <Button type="submit" variant="outline" disabled={pending}>
                Ara
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <Filter
                label="Gönderim durumu"
                value={query.status ?? "ALL"}
                options={EMAIL_SEND_STATUS}
                onChange={(value) =>
                  navigate({
                    status:
                      value === "ALL" ? undefined : (value as EmailSendStatus),
                  })
                }
              />
              <Filter
                label="Teslimat durumu"
                value={query.deliveryStatus ?? "ALL"}
                options={EMAIL_DELIVERY_STATUS}
                onChange={(value) =>
                  navigate({
                    deliveryStatus:
                      value === "ALL"
                        ? undefined
                        : (value as EmailDeliveryStatus),
                  })
                }
              />
              <label className="space-y-1 text-xs text-muted-foreground">
                Başlangıç
                <Input
                  aria-label="Başlangıç tarihi"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-9 w-40 bg-background"
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                Bitiş
                <Input
                  aria-label="Bitiş tarihi"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-9 w-40 bg-background"
                />
              </label>
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={pending}
              >
                Uygula
              </Button>
              {filtered ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    navigate({
                      q: undefined,
                      status: undefined,
                      deliveryStatus: undefined,
                      from: undefined,
                      to: undefined,
                      storeId: undefined,
                      announcementId: undefined,
                    })
                  }
                >
                  Filtreleri temizle
                </Button>
              ) : null}
            </div>
            {dateError ? (
              <p role="alert" className="text-xs text-destructive">
                {dateError}
              </p>
            ) : null}
          </form>
        </div>
        <div className="my-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>{data.pagination.total.toLocaleString("tr-TR")} gönderim</span>
          <span>Tarihler Türkiye saatine göredir.</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {data.items.length ? (
            data.items.map((email) => (
              <Link
                key={email.id}
                href={APP_ROUTES.admin.email(email.id)}
                className="group flex flex-col gap-3 border-b border-border px-4 py-4 last:border-0 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {email.subject}
                  </p>
                  <p className="mt-1 text-xs break-all text-muted-foreground">
                    {email.recipientEmail}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {email.workspace?.name ?? "Hesapla ilişkilendirilmemiş"}
                    {email.store ? ` · ${email.store.name}` : ""} ·{" "}
                    {emailTypeLabel(email.emailType)}
                  </p>
                  {email.lastErrorMessage ? (
                    <p className="mt-1 line-clamp-1 text-xs text-destructive">
                      {email.lastErrorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:max-w-[360px] sm:items-end">
                  <EmailStatusBadges email={email} />
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <time dateTime={email.createdAt}>
                      {formatEmailDate(email.createdAt)}
                    </time>
                    <span>{email.attemptCount} deneme</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-5 py-16 text-center">
              <HugeiconsIcon
                icon={Mail01Icon}
                className="mx-auto size-8 text-muted-foreground"
              />
              <p className="mt-4 text-sm font-medium">
                {filtered
                  ? "Filtrelere uygun e-posta bulunamadı"
                  : "Henüz e-posta kaydı yok"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {filtered
                  ? "Aramayı veya filtreleri değiştirerek tekrar deneyin."
                  : "Uygulamanın oluşturduğu gönderimler burada görünecek."}
              </p>
            </div>
          )}
        </div>
        {data.pagination.totalPages > 1 || data.pagination.page > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Sayfa {data.pagination.page} / {data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending || data.pagination.page <= 1}
                onClick={() => navigate({ page: data.pagination.page - 1 })}
              >
                Önceki
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  pending || data.pagination.page >= data.pagination.totalPages
                }
                onClick={() => navigate({ page: data.pagination.page + 1 })}
              >
                Sonraki
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      <p className="mt-5 text-[11px] text-muted-foreground">
        Son kontrol: {formatEmailDate(data.health.checkedAt)} · Sayfa açıkken 30
        saniyede bir yenilenir.
      </p>
    </main>
  )
}

function Health({
  label,
  ok,
  value,
  note,
}: {
  label: string
  ok: boolean
  value: string
  note: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-sm font-medium ${ok ? "" : "text-amber-600 dark:text-amber-400"}`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] break-words text-muted-foreground">
        {note}
      </p>
    </div>
  )
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Record<string, { label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label={label}
          className="h-9 w-[210px] bg-background"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tüm durumlar</SelectItem>
          {Object.entries(options).map(([key, option]) => (
            <SelectItem key={key} value={key}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function dateInput(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
