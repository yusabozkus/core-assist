"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  Archive02Icon,
  ArrowLeft01Icon,
  Mail01Icon,
  RefreshIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { updateAdminContactMessageStatus } from "@/lib/api/admin-contact"
import type { AdminContactMessage, ContactMessageStatus } from "@/types/contact"
import {
  CONTACT_STATUS,
  CONTACT_TOPIC,
  formatContactDate,
} from "./admin-contact-presentation"

export function AdminContactMessageDetail({
  initialMessage,
}: {
  initialMessage: AdminContactMessage
}) {
  const [message, setMessage] = useState(initialMessage)
  const [isPending, startTransition] = useTransition()
  const status = CONTACT_STATUS[message.status]

  function changeStatus(nextStatus: ContactMessageStatus) {
    startTransition(async () => {
      try {
        setMessage(
          await updateAdminContactMessageStatus(message.id, nextStatus)
        )
        toast.success("Mesaj durumu güncellendi.")
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Mesaj durumu güncellenemedi."
        )
      }
    })
  }

  const mailto = `mailto:${message.email}?subject=${encodeURIComponent(`Core Asistan: ${message.subject}`)}`

  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10">
      <Link
        href={APP_ROUTES.admin.contactMessages}
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
        İletişim mesajlarına dön
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
            <Badge variant="outline">{CONTACT_TOPIC[message.topic]}</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
            {message.subject}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatContactDate(message.createdAt)} tarihinde gönderildi
          </p>
        </div>
        <Button asChild size="sm">
          <a href={mailto}>
            <HugeiconsIcon icon={Mail01Icon} className="size-3.5" />
            E-posta ile yanıtla
          </a>
        </Button>
      </div>

      <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Mesaj
          </p>
          <p className="mt-4 text-sm leading-7 whitespace-pre-wrap text-foreground/90">
            {message.message}
          </p>
        </article>

        <aside className="h-fit rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">Gönderen</p>
          <dl className="mt-4 space-y-4 text-xs">
            <Fact label="Ad soyad" value={message.name} />
            <Fact label="E-posta" value={message.email} />
            <Fact label="Şirket / mağaza" value={message.company ?? "—"} />
            <Fact label="Kaynak" value={message.sourcePage ?? "—"} />
          </dl>

          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Durum
            </p>
            <div className="space-y-2">
              {message.status !== "READ" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isPending}
                  onClick={() => changeStatus("READ")}
                >
                  <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
                  Okundu olarak işaretle
                </Button>
              ) : null}
              {message.status !== "ARCHIVED" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  disabled={isPending}
                  onClick={() => changeStatus("ARCHIVED")}
                >
                  <HugeiconsIcon icon={Archive02Icon} className="size-3.5" />
                  Arşivle
                </Button>
              ) : null}
              {message.status !== "NEW" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={isPending}
                  onClick={() => changeStatus("NEW")}
                >
                  <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
                  Yeni olarak işaretle
                </Button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium break-words text-foreground">{value}</dd>
    </div>
  )
}
