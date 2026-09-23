"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Clock01Icon,
  CustomerSupportIcon,
  InformationCircleIcon,
  Loading03Icon,
  RefreshIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Textarea } from "@/components/ui/textarea"
import {
  getSupportTicket,
  replyToSupportTicket,
  updateSupportTicketStatus,
} from "@/lib/api/support"
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/api/notifications"
import { cn, getInitials } from "@/lib/utils"
import type { SupportMessage, SupportTicketDetail } from "@/types/support"
import {
  getSupportCategoryLabel,
  SUPPORT_STATUS,
} from "./support-ticket-presentation"

const MAX_COMPOSER_HEIGHT = 164
const POLL_INTERVAL_MS = 20_000

export function SupportTicketConversation({
  initialTicket,
}: {
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
  const mutationPendingRef = useRef(false)
  const refreshQueuedRef = useRef(false)
  const refreshRequestRef = useRef<AbortController | null>(null)
  const refreshVersionRef = useRef(0)
  const isPending = pendingAction !== null
  const status = SUPPORT_STATUS[ticket.status]
  const isResolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED"

  const cancelPendingRefresh = useCallback(() => {
    refreshVersionRef.current += 1
    refreshRequestRef.current?.abort()
    refreshRequestRef.current = null
  }, [])

  const refreshTicket = useCallback(async () => {
    if (document.visibilityState === "hidden") return
    if (mutationPendingRef.current) {
      refreshQueuedRef.current = true
      return
    }

    cancelPendingRefresh()
    const requestVersion = refreshVersionRef.current
    const controller = new AbortController()
    refreshRequestRef.current = controller

    try {
      const nextTicket = await getSupportTicket(ticket.id, controller.signal)
      if (
        !controller.signal.aborted &&
        !mutationPendingRef.current &&
        refreshVersionRef.current === requestVersion
      ) {
        setTicket(nextTicket)
      }
    } catch {
      // Geçici bağlantı hatalarında son başarılı konuşma korunur.
    } finally {
      if (refreshRequestRef.current === controller) {
        refreshRequestRef.current = null
      }
    }
  }, [cancelPendingRefresh, ticket.id])

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

  useEffect(() => {
    const intervalId = window.setInterval(
      () => void refreshTicket(),
      POLL_INTERVAL_MS
    )

    function handleVisible() {
      if (document.visibilityState === "visible") void refreshTicket()
    }

    function handleNotificationChange(event: Event) {
      const changedStoreId = (event as CustomEvent<{ storeId?: string }>).detail
        ?.storeId
      if (!changedStoreId || changedStoreId === ticket.store?.id) {
        void refreshTicket()
      }
    }

    window.addEventListener("focus", handleVisible)
    document.addEventListener("visibilitychange", handleVisible)
    window.addEventListener(
      NOTIFICATIONS_CHANGED_EVENT,
      handleNotificationChange
    )

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", handleVisible)
      document.removeEventListener("visibilitychange", handleVisible)
      window.removeEventListener(
        NOTIFICATIONS_CHANGED_EVENT,
        handleNotificationChange
      )
      cancelPendingRefresh()
    }
  }, [cancelPendingRefresh, refreshTicket, ticket.store?.id])

  async function submitReply() {
    const value = message.trim()
    if (value.length < 2 || isPending || mutationPendingRef.current) return

    setError(null)
    setPendingAction("reply")
    mutationPendingRef.current = true
    cancelPendingRefresh()
    try {
      const nextTicket = await replyToSupportTicket(ticket.id, value)
      setTicket(nextTicket)
      setMessage("")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Mesaj gönderilemedi. Lütfen tekrar deneyin."
      )
    } finally {
      mutationPendingRef.current = false
      setPendingAction(null)
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false
        void refreshTicket()
      }
    }
  }

  async function changeStatus(action: "RESOLVE" | "REOPEN") {
    if (isPending || mutationPendingRef.current) return

    setError(null)
    setPendingAction("status")
    mutationPendingRef.current = true
    cancelPendingRefresh()
    try {
      setTicket(await updateSupportTicketStatus(ticket.id, action))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Talep durumu güncellenemedi."
      )
    } finally {
      mutationPendingRef.current = false
      setPendingAction(null)
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false
        void refreshTicket()
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col sm:min-h-[620px]">
      <header className="shrink-0 border-b border-border px-4 py-3 sm:px-8 sm:pt-7 sm:pb-5 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1080px] min-w-0 items-center gap-2.5 sm:items-start sm:gap-4">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="-ml-1 size-9 shrink-0 rounded-full sm:mt-0.5 sm:ml-0"
          >
            <Link
              href="/dashboard/support?view=tickets"
              aria-label="Destek taleplerine dön"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Link>
          </Button>

          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-col items-stretch gap-1 sm:block">
                <h1 className="w-full min-w-0 truncate text-base leading-6 font-semibold tracking-tight sm:overflow-visible sm:text-2xl sm:leading-8 sm:[overflow-wrap:anywhere] sm:text-clip sm:whitespace-normal">
                  {ticket.subject}
                </h1>
                <Badge variant={status.tone} className="shrink-0 sm:hidden">
                  {status.label}
                </Badge>
              </div>
              <div className="mt-2 hidden flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground sm:flex">
                <span className="shrink-0 font-semibold tracking-wide text-foreground/70">
                  {ticket.code}
                </span>
                <span className="min-w-0 truncate">
                  {ticket.store?.name ?? "Genel hesap talebi"}
                </span>
                <span className="shrink-0">
                  {formatFullDate(ticket.createdAt)}
                  <span> tarihinde açıldı</span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
                  {ticket.firstRespondedAt
                    ? "Destek ekibi yanıtladı"
                    : `İlk yanıt hedefi ${formatDeadline(ticket.firstResponseDueAt)}`}
                </span>
              </div>
            </div>

            <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
              <Badge variant="default">
                {getSupportCategoryLabel(ticket.category)}
              </Badge>
              <Badge variant={status.tone}>{status.label}</Badge>
            </div>
          </div>

          <Drawer>
            <DrawerTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-9 shrink-0 rounded-full text-muted-foreground sm:hidden"
                aria-label="Talep bilgilerini göster"
              >
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  className="size-4.5"
                />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85dvh] overflow-hidden pb-[env(safe-area-inset-bottom)]">
              <DrawerHeader className="flex-row items-start justify-between gap-3 px-4 pt-4 pb-3 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
                <div className="min-w-0">
                  <DrawerTitle className="text-lg font-semibold">
                    Talep bilgileri
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 text-xs leading-5 [overflow-wrap:anywhere]">
                    {ticket.subject}
                  </DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 shrink-0 rounded-full"
                    aria-label="Kapat"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                  </Button>
                </DrawerClose>
              </DrawerHeader>
              <dl className="themed-scrollbar min-h-0 divide-y divide-border overflow-y-auto px-4 pb-4">
                <TicketInfoRow label="Talep numarası">
                  {ticket.code}
                </TicketInfoRow>
                <TicketInfoRow label="Kategori">
                  {getSupportCategoryLabel(ticket.category)}
                </TicketInfoRow>
                <TicketInfoRow label="Mağaza">
                  {ticket.store?.name ?? "Genel hesap talebi"}
                </TicketInfoRow>
                <TicketInfoRow label="Açılış tarihi">
                  {formatFullDate(ticket.createdAt)}
                </TicketInfoRow>
                <TicketInfoRow label="İlk yanıt">
                  {ticket.firstRespondedAt
                    ? formatFullDate(ticket.firstRespondedAt)
                    : `Hedef: ${formatDeadline(ticket.firstResponseDueAt)}`}
                </TicketInfoRow>
                <TicketInfoRow label="Son mesaj">
                  {formatFullDate(ticket.lastMessageAt)}
                </TicketInfoRow>
              </dl>
            </DrawerContent>
          </Drawer>
        </div>
      </header>

      <main
        ref={messagesViewportRef}
        className="themed-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-9"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-6">
          {ticket.messages.map((item) => (
            <SupportMessageBubble key={item.id} message={item} />
          ))}
        </div>
      </main>

      <footer className="shrink-0 bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8 sm:pt-3 sm:pb-7">
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
                className="subtle-scrollbar max-h-[164px] min-h-24 resize-none rounded-none border-0 bg-transparent px-3.5 pt-3 pb-14 shadow-none focus-visible:ring-0 disabled:cursor-default disabled:opacity-70 sm:min-h-28 sm:px-4 sm:pt-4 sm:pb-16"
              />

              <div className="pointer-events-none absolute inset-x-px bottom-px flex items-end justify-between gap-2 bg-gradient-to-t from-card via-card/95 to-transparent px-2.5 pt-5 pb-2.5 sm:gap-3 sm:px-3 sm:pt-6 sm:pb-3">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {message.length}/5000
                </span>
                <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isResolved ? "outline" : "destructive"}
                    disabled={isPending}
                    className={cn(
                      "h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-2 sm:px-3 sm:text-sm",
                      isResolved && "bg-card/95 backdrop-blur-sm"
                    )}
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
                    <span className="sm:hidden">
                      {isResolved ? "Yeniden aç" : "Kapat"}
                    </span>
                    <span className="hidden sm:inline">
                      {isResolved ? "Talebi yeniden aç" : "Talebi kapat"}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
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
        <span className="max-w-full rounded-full bg-muted px-3 py-1 text-center text-[10px] [overflow-wrap:anywhere] break-words text-muted-foreground">
          {message.body}
        </span>
      </div>
    )
  }

  const isCustomer = message.authorType === "CUSTOMER"
  const name = isCustomer
    ? (message.author?.name ?? "Ekip üyesi")
    : (message.author?.name ?? "Destek ekibi")

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
      <div
        className={cn(
          "max-w-[85%] min-w-0 sm:max-w-[78%]",
          isCustomer && "text-right"
        )}
      >
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
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
            "rounded-2xl px-3.5 py-2.5 text-left text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap",
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

function TicketInfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere] break-words">
        {children}
      </dd>
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
