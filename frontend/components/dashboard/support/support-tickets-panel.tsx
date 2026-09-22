"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight01Icon,
  Cancel01Icon,
  InboxIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SupportTicketList, SupportTicketSummary } from "@/types/support"
import {
  getSupportCategoryLabel,
  SUPPORT_STATUS,
} from "./support-ticket-presentation"

type TicketFilter = "active" | "resolved" | "all"

export function SupportTicketsPanel({
  tickets,
}: {
  tickets: SupportTicketList
}) {
  const [filter, setFilter] = useState<TicketFilter>("active")
  const [query, setQuery] = useState("")
  const normalizedQuery = normalizeSearch(query)
  const activeCount =
    tickets.counts.OPEN +
    tickets.counts.IN_PROGRESS +
    tickets.counts.WAITING_CUSTOMER
  const resolvedCount = tickets.counts.RESOLVED + tickets.counts.CLOSED
  const filteredTickets = useMemo(
    () =>
      tickets.items.filter((ticket) => {
        if (!matchesFilter(ticket, filter)) return false
        if (!normalizedQuery) return true

        return normalizeSearch(
          `${ticket.code} ${ticket.subject} ${ticket.store?.name ?? ""} ${ticket.lastMessage?.body ?? ""} ${getSupportCategoryLabel(ticket.category)}`
        ).includes(normalizedQuery)
      }),
    [filter, normalizedQuery, tickets.items]
  )

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Destek talepleriniz
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Açık taleplerinizi takip edin ve geçmiş görüşmelerinize ulaşın.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Toplam{" "}
          <span className="font-semibold text-foreground">{tickets.total}</span>{" "}
          talep
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Talep no, konu veya mesaj ara..."
          aria-label="Destek taleplerinde ara"
          icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
          endIcon={
            query ? (
              <button
                type="button"
                className="pointer-events-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setQuery("")}
                aria-label="Aramayı temizle"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            ) : null
          }
          className="h-10 w-full bg-card shadow-xs sm:max-w-md"
        />

        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as TicketFilter)}
        >
          <SelectTrigger
            className="h-10 w-full rounded-xl border-border bg-card shadow-xs sm:w-[190px]"
            aria-label="Talepleri duruma göre filtrele"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="active">Açık ({activeCount})</SelectItem>
            <SelectItem value="resolved">Çözülen ({resolvedCount})</SelectItem>
            <SelectItem value="all">Tümü ({tickets.total})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {filteredTickets.length ? (
          <div className="divide-y divide-border">
            {filteredTickets.map((ticket) => (
              <TicketListItem key={ticket.id} ticket={ticket} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <HugeiconsIcon icon={InboxIcon} className="size-4.5" />
            </span>
            <p className="mt-4 text-sm font-semibold">
              {query ? "Aramanızla eşleşen talep yok" : "Bu durumda talep yok"}
            </p>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">
              {query
                ? "Farklı bir ifade deneyin veya aramayı temizleyin."
                : "Diğer filtreleri kontrol edebilir veya yeni bir destek talebi oluşturabilirsiniz."}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function TicketListItem({ ticket }: { ticket: SupportTicketSummary }) {
  const status = SUPPORT_STATUS[ticket.status]

  return (
    <Link
      href={`/dashboard/support/tickets/${ticket.id}`}
      className="group grid gap-3 px-4 py-3.5 transition-colors hover:bg-muted/35 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
            {ticket.code}
          </span>
          <Badge
            variant={status.tone}
            className="px-2 py-0 text-[10px] leading-4"
          >
            {status.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {getSupportCategoryLabel(ticket.category)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {ticket.store?.name ?? "Genel hesap talebi"}
          </span>
        </div>
        <h3 className="mt-2 truncate text-sm font-semibold tracking-tight">
          {ticket.subject}
        </h3>
        <p className="mt-1 line-clamp-1 max-w-3xl text-xs leading-4 text-muted-foreground">
          {ticket.lastMessage?.body ?? "Henüz mesaj bulunmuyor."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-left sm:text-right">
          <p className="text-[10px] text-muted-foreground">Son hareket</p>
          <p className="mt-0.5 text-[11px] font-medium">
            {formatRelativeDate(ticket.lastMessageAt)}
          </p>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-all group-hover:border-primary/25 group-hover:bg-primary/5 group-hover:text-primary">
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </Link>
  )
}

function matchesFilter(ticket: SupportTicketSummary, filter: TicketFilter) {
  if (filter === "all") return true
  const resolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED"
  return filter === "resolved" ? resolved : !resolved
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date)
}
