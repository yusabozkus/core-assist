"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Mail01Icon,
  Search01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
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
  AdminContactMessageList as ContactList,
  AdminContactMessageQuery,
  ContactMessageStatus,
  ContactMessageTopic,
} from "@/types/contact"
import {
  CONTACT_STATUS,
  CONTACT_TOPIC,
  formatContactDate,
} from "./admin-contact-presentation"

const ALL = "ALL"

export function AdminContactMessageList({
  data,
  query,
}: {
  data: ContactList
  query: AdminContactMessageQuery
}) {
  const router = useRouter()
  const [search, setSearch] = useState(query.q ?? "")
  const [isNavigating, startTransition] = useTransition()

  function navigate(changes: Partial<AdminContactMessageQuery>) {
    const next = { ...query, ...changes, page: changes.page ?? 1 }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== "") params.set(key, String(value))
    }
    startTransition(() => {
      router.replace(
        `${APP_ROUTES.admin.contactMessages}${params.size ? `?${params}` : ""}`
      )
    })
  }

  return (
    <main
      className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10"
      aria-busy={isNavigating}
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Landing iletişimi
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            İletişim mesajları
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hesap açmadan gönderilen ürün, fiyatlandırma ve iş ortaklığı
            mesajlarını inceleyin.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Filtre sonucunda {data.pagination.total} mesaj
        </p>
      </div>

      <section className="mt-7 grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3">
        <Summary label="Yeni" value={data.summary.new} icon={Mail01Icon} />
        <Summary label="Okundu" value={data.summary.read} icon={ViewIcon} />
        <Summary
          label="Arşivlendi"
          value={data.summary.archived}
          icon={Archive02Icon}
        />
      </section>

      <section className="mt-6">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs lg:flex-row lg:items-center">
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              navigate({ q: search.trim() || undefined })
            }}
          >
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="İsim, e-posta, şirket veya konu ara..."
              aria-label="İletişim mesajlarında ara"
              icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
              endIcon={
                search ? (
                  <button
                    type="button"
                    aria-label="Aramayı temizle"
                    className="pointer-events-auto flex size-7 items-center justify-center rounded-lg hover:bg-muted"
                    onClick={() => {
                      setSearch("")
                      if (query.q) navigate({ q: undefined })
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                  </button>
                ) : null
              }
              className="h-10 bg-background shadow-none"
            />
            <Button type="submit" size="sm" variant="outline">
              Ara
            </Button>
          </form>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Filter
              value={query.status ?? ALL}
              placeholder="Durum"
              options={Object.entries(CONTACT_STATUS).map(([value, item]) => ({
                value,
                label: item.label,
              }))}
              onChange={(value) =>
                navigate({
                  status:
                    value === ALL ? undefined : (value as ContactMessageStatus),
                })
              }
            />
            <Filter
              value={query.topic ?? ALL}
              placeholder="Konu"
              options={Object.entries(CONTACT_TOPIC).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={(value) =>
                navigate({
                  topic:
                    value === ALL ? undefined : (value as ContactMessageTopic),
                })
              }
            />
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
          {data.items.length ? (
            data.items.map((message, index) => {
              const status = CONTACT_STATUS[message.status]
              return (
                <Link
                  key={message.id}
                  href={APP_ROUTES.admin.contactMessage(message.id)}
                  className={`group grid gap-3 px-4 py-4 transition-colors hover:bg-muted/45 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5 ${index ? "border-t border-border" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {message.subject}
                      </p>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                      <Badge variant="outline">
                        {CONTACT_TOPIC[message.topic]}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {message.name} · {message.email}
                      {message.company ? ` · ${message.company}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-1 text-xs leading-5 text-muted-foreground/90">
                      {message.message}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <time className="text-[11px] whitespace-nowrap text-muted-foreground">
                      {formatContactDate(message.createdAt)}
                    </time>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                </Link>
              )
            })
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-sm font-medium">Mesaj bulunamadı</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Filtreleri değiştirerek tekrar deneyin.
              </p>
            </div>
          )}
        </div>

        {data.pagination.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Sayfa {data.pagination.page} / {data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={data.pagination.page <= 1}
                onClick={() => navigate({ page: data.pagination.page - 1 })}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                Önceki
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => navigate({ page: data.pagination.page + 1 })}
              >
                Sonraki
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

function Summary({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: typeof Mail01Icon
}) {
  return (
    <div className="flex items-center gap-3 border-border p-4 not-first:border-t sm:not-first:border-t-0 sm:not-first:border-l">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <HugeiconsIcon icon={icon} className="size-4" />
      </span>
      <div>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function Filter({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string
  placeholder: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-10 w-full min-w-36 rounded-lg border-border bg-background sm:w-auto">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tümü</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
