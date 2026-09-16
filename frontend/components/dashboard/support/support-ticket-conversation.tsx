"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Clock01Icon,
  CustomerSupportIcon,
  Loading03Icon,
  RefreshIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  replyToSupportTicket,
  updateSupportTicketStatus,
} from "@/lib/api/support"
import { cn, getInitials } from "@/lib/utils"
import type { SupportMessage, SupportTicketDetail } from "@/types/support"
import {
  getSupportCategoryLabel,
  SUPPORT_STATUS,
} from "./support-ticket-presentation"

const MAX_COMPOSER_HEIGHT = 164

export function SupportTicketConversation({
  storeId,
  initialTicket,
}: {
  storeId: string
  initialTicket: SupportTicketDetail
}) {
  const [ticket, setTicket] = useState(initialTicket)
  const [message, setMessage] = useState("")
  const [pendingAction, setPendingAction] = useState<"reply" | "status" | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const messagesViewportRef = useRef<HTMLElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const hasScrolledRef = useRef(false)
  const isPending = pendingAction !== null
  const status = SUPPORT_STATUS[ticket.status]
  const isResolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED"

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const viewport = messagesViewportRef.current
      if (!viewport) return

      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: hasScrolledRef.current ? "smooth" : "auto",
      })
      hasScrolledRef.current = true
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [ticket.messages.length])

  useEffect(() => {
    const input = messageInputRef.current
    if (!input) return

    input.style.height = "auto"
    const nextHeight = Math.min(input.scrollHeight, MAX_COMPOSER_HEIGHT)
    input.style.height = `${nextHeight}px`
    input.style.overflowY =
      input.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden"
  }, [message])

  async function submitReply() {
    const value = message.trim()
    if (value.length < 2 || isPending) return

    setError(null)
    setPendingAction("reply")
    try {
      const nextTicket = await replyToSupportTicket(storeId, ticket.id, value)
      setTicket(nextTicket)
      setMessage("")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mesaj gönderilemedi. Lütfen tekrar deneyin."
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function changeStatus(action: "RESOLVE" | "REOPEN") {
    if (isPending) return

    setError(null)
    setPendingAction("status")
    try {
      setTicket(await updateSupportTicketStatus(storeId, ticket.id, action))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Talep durumu güncellenemedi."
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="flex h-full min-h-[620px] w-full flex-col">
      <header className="shrink-0 border-b border-border px-4 pt-5 pb-5 sm:px-8 sm:pt-7 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1080px] items-start gap-3 sm:gap-4">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0 rounded-full"
          >
            <Link
              href="/dashboard/support?view=tickets"
              aria-label="Destek taleplerine dön"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Link>
          </Button>

          <div className="flex flex-1 flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {ticket.subject}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
                <span className="font-semibold tracking-wide text-foreground/70">
                  {ticket.code}
                </span>
                <span>{ticket.store?.name ?? "Mağaza"}</span>
                <span>{formatFullDate(ticket.createdAt)} tarihinde açıldı</span>
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                  {ticket.firstRespondedAt
                    ? "Destek ekibi yanıtladı"
                    : `İlk yanıt hedefi ${formatDeadline(ticket.firstResponseDueAt)}`}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Badge variant="default">
                {getSupportCategoryLabel(ticket.category)}
              </Badge>
              <Badge variant={status.tone}>{status.label}</Badge>
            </div>
          </div>
        </div>
      </header>

      <main
        ref={messagesViewportRef}
        className="themed-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-8 sm:py-9"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {ticket.messages.map((item) => (
            <SupportMessageBubble key={item.id} message={item} />
          ))}
        </div>
      </main>

      <footer className="shrink-0 bg-background px-4 pt-3 pb-5 sm:px-8 sm:pb-7">
        <div className="mx-auto w-full max-w-4xl">
          {isResolved ? (
            <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Bu talep kapalı. Mesaj göndermek için yeniden açın.
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] focus-within:border-primary/35 focus-within:shadow-md">
            <div className="relative">
              <Textarea
                ref={messageInputRef}
                value={message}
                maxLength={5000}
                rows={2}
                disabled={isResolved || isPending}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey)
                  ) {
                    event.preventDefault()
                    void submitReply()
                  }
                }}
                placeholder={
                  isResolved
                    ? "Bu talep kapalı"
                    : "Destek ekibine mesajınızı yazın..."
                }
                className="subtle-scrollbar max-h-[164px] min-h-28 resize-none rounded-none border-0 bg-transparent px-4 pt-4 pb-16 shadow-none focus-visible:ring-0 disabled:cursor-default disabled:opacity-70"
              />

              <div className="pointer-events-none absolute inset-x-px bottom-px flex items-end justify-between gap-3 bg-gradient-to-t from-card via-card/95 to-transparent px-3 pt-6 pb-3">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {message.length}/5000
                </span>
                <div className="pointer-events-auto flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isResolved ? "outline" : "destructive"}
                    disabled={isPending}
                    className={isResolved ? "bg-card/95 backdrop-blur-sm" : ""}
                    onClick={() =>
                      void changeStatus(isResolved ? "REOPEN" : "RESOLVE")
                    }
                  >
                    <HugeiconsIcon
                      icon={
                        pendingAction === "status"
                          ? Loading03Icon
                          : isResolved
                            ? RefreshIcon
                            : Cancel01Icon
                      }
                      className={cn(
                        "size-3.5",
                        pendingAction === "status" && "animate-spin"
                      )}
                    />
                    {isResolved ? "Talebi yeniden aç" : "Talebi kapat"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      isResolved || isPending || message.trim().length < 2
                    }
                    onClick={() => void submitReply()}
                  >
                    <HugeiconsIcon
                      icon={
                        pendingAction === "reply" ? Loading03Icon : SentIcon
                      }
                      className={cn(
                        "size-3.5",
                        pendingAction === "reply" && "animate-spin"
                      )}
                    />
                    {pendingAction === "reply" ? "Gönderiliyor" : "Gönder"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <p className="mt-2 px-1 text-xs text-destructive">{error}</p>
          ) : null}
        </div>
      </footer>
    </div>
  )
}

function SupportMessageBubble({ message }: { message: SupportMessage }) {
  if (message.authorType === "SYSTEM") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground">
          {message.body}
        </span>
      </div>
    )
  }

  const isCustomer = message.authorType === "CUSTOMER"
  const name = isCustomer
    ? (message.author?.name ?? "Ekip üyesi")
    : "Core Asistan"

  return (
    <div
      className={cn(
        "flex items-end gap-2.5",
        isCustomer ? "justify-end" : "justify-start"
      )}
    >
      {!isCustomer ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <HugeiconsIcon icon={CustomerSupportIcon} className="size-3.5" />
        </span>
      ) : null}
      <div className={cn("max-w-[78%]", isCustomer && "text-right")}>
        <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          {isCustomer ? (
            <span className="ml-auto">{formatFullDate(message.createdAt)}</span>
          ) : (
            <>
              <span>{name}</span>
              <span>{formatFullDate(message.createdAt)}</span>
            </>
          )}
        </div>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-left text-sm leading-5 whitespace-pre-wrap",
            isCustomer
              ? "rounded-br-md border border-border/70 bg-secondary text-secondary-foreground"
              : "rounded-bl-md border border-border bg-card text-foreground shadow-sm"
          )}
        >
          {message.body}
        </div>
      </div>
      {isCustomer ? (
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={message.author?.image ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  )
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
