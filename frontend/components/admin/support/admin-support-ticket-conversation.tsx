"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft01Icon,
  CustomerSupportIcon,
  Loading03Icon,
  NoteIcon,
  SentIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getSupportCategoryLabel } from "@/components/dashboard/support/support-ticket-presentation"
import {
  addAdminSupportMessage,
  getAdminSupportTicket,
  updateAdminSupportAssignee,
  updateAdminSupportStatus,
} from "@/lib/api/admin-support"
import { cn, getInitials } from "@/lib/utils"
import type {
  AdminSupportMessage,
  AdminSupportPerson,
  AdminSupportTicketDetail,
} from "@/types/admin-support"
import type { SupportTicketStatus } from "@/types/support"
import {
  ADMIN_SUPPORT_PRIORITY,
  ADMIN_SUPPORT_STATUS,
  ADMIN_SUPPORT_STATUS_OPTIONS,
  formatAdminSupportDate,
} from "./admin-support-presentation"

const UNASSIGNED = "UNASSIGNED"
const MAX_COMPOSER_HEIGHT = 168
const POLL_INTERVAL_MS = 20_000

export function AdminSupportTicketConversation({
  initialTicket,
  agents,
}: {
  initialTicket: AdminSupportTicketDetail
  agents: AdminSupportPerson[]
}) {
  const router = useRouter()
  const [ticket, setTicket] = useState(initialTicket)
  const [referenceTime] = useState(() => Date.now())
  const [message, setMessage] = useState("")
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC")
  const [pendingAction, setPendingAction] = useState<
    "message" | "status" | "assignee" | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const messagesViewportRef = useRef<HTMLElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const hasScrolledRef = useRef(false)
  const mutationPendingRef = useRef(false)
  const isClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED"
  const publicReplyDisabled = isClosed && visibility === "PUBLIC"

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
    const controller = new AbortController()
    const intervalId = window.setInterval(async () => {
      if (document.visibilityState === "hidden" || mutationPendingRef.current) {
        return
      }

      try {
        setTicket(await getAdminSupportTicket(ticket.id, controller.signal))
      } catch {
        // Keep the last successful ticket snapshot during transient failures.
      }
    }, POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [ticket.id])

  async function submitMessage() {
    const value = message.trim()
    if (value.length < 2 || pendingAction || publicReplyDisabled) return

    setError(null)
    setPendingAction("message")
    mutationPendingRef.current = true
    try {
      setTicket(await addAdminSupportMessage(ticket.id, value, visibility))
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
    }
  }

  async function changeStatus(status: SupportTicketStatus) {
    if (pendingAction || status === ticket.status) return
    setError(null)
    setPendingAction("status")
    mutationPendingRef.current = true
    try {
      setTicket(await updateAdminSupportStatus(ticket.id, status))
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Talep durumu güncellenemedi."
      )
    } finally {
      mutationPendingRef.current = false
      setPendingAction(null)
    }
  }

  async function changeAssignee(assigneeUserId: string) {
    if (pendingAction) return
    setError(null)
    setPendingAction("assignee")
    mutationPendingRef.current = true
    try {
      setTicket(
        await updateAdminSupportAssignee(
          ticket.id,
          assigneeUserId === UNASSIGNED ? null : assigneeUserId
        )
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Talep ataması güncellenemedi."
      )
    } finally {
      mutationPendingRef.current = false
      setPendingAction(null)
    }
  }

  const status = ADMIN_SUPPORT_STATUS[ticket.status]
  const priority = ADMIN_SUPPORT_PRIORITY[ticket.priority]

  return (
    <div className="flex min-h-svh flex-col bg-background lg:h-[calc(100svh-1rem)] lg:min-h-0 lg:overflow-hidden">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-7">
        <div className="mx-auto flex w-full max-w-[1440px] items-start gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0"
            onClick={() => router.back()}
            aria-label="Destek taleplerine dön"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                {ticket.code}
              </span>
              <Badge
                variant="outline"
                className={cn("px-2 py-0 text-[10px]", status.className)}
              >
                {status.label}
              </Badge>
              <span
                className={cn("text-[10px] font-medium", priority.className)}
              >
                {priority.label} öncelik
              </span>
            </div>
            <h1 className="mt-1.5 truncate text-lg font-semibold tracking-tight sm:text-xl">
              {ticket.subject}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>{ticket.createdBy?.name ?? "Silinmiş kullanıcı"}</span>
              <span>{ticket.workspace.name}</span>
              <span>
                {formatAdminSupportDate(ticket.createdAt)} tarihinde açıldı
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col lg:overflow-hidden lg:flex-row">
        <section className="flex min-h-[620px] min-w-0 flex-1 flex-col lg:min-h-0">
          <main
            ref={messagesViewportRef}
            className="themed-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-8"
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              {ticket.messages.map((item) => (
                <AdminMessageBubble key={item.id} message={item} />
              ))}
            </div>
          </main>

          <footer className="sticky bottom-0 z-10 shrink-0 bg-background/95 px-4 pt-3 pb-5 backdrop-blur-sm sm:px-8 sm:pb-7 lg:static">
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <div className="flex rounded-lg bg-muted p-0.5">
                  <ComposerModeButton
                    active={visibility === "PUBLIC"}
                    onClick={() => setVisibility("PUBLIC")}
                  >
                    Kullanıcıya yanıt
                  </ComposerModeButton>
                  <ComposerModeButton
                    active={visibility === "INTERNAL"}
                    onClick={() => setVisibility("INTERNAL")}
                  >
                    Dahili not
                  </ComposerModeButton>
                </div>
                <span className="hidden text-[10px] text-muted-foreground sm:block">
                  Ctrl + Enter ile gönder
                </span>
              </div>

              {publicReplyDisabled ? (
                <p className="mb-2 px-1 text-[11px] text-amber-700 dark:text-amber-400">
                  Kullanıcıya yanıt vermek için talebi yeniden açın. Dahili not
                  eklemeye devam edebilirsiniz.
                </p>
              ) : null}

              <div
                className={cn(
                  "overflow-hidden rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] focus-within:shadow-md",
                  visibility === "INTERNAL"
                    ? "border-amber-500/30 focus-within:border-amber-500/50"
                    : "border-border focus-within:border-primary/35"
                )}
              >
                <div className="relative">
                  <Textarea
                    ref={messageInputRef}
                    value={message}
                    maxLength={5000}
                    rows={2}
                    disabled={Boolean(pendingAction) || publicReplyDisabled}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        (event.ctrlKey || event.metaKey)
                      ) {
                        event.preventDefault()
                        void submitMessage()
                      }
                    }}
                    placeholder={
                      visibility === "INTERNAL"
                        ? "Yalnızca destek ekibinin görebileceği bir not ekleyin..."
                        : "Kullanıcıya yanıtınızı yazın..."
                    }
                    className="subtle-scrollbar max-h-[168px] min-h-24 resize-none rounded-none border-0 bg-transparent px-4 pt-4 pb-15 shadow-none focus-visible:ring-0 disabled:cursor-default disabled:opacity-65"
                  />

                  <div className="pointer-events-none absolute inset-x-px bottom-px flex items-end justify-between gap-3 bg-gradient-to-t from-card via-card/95 to-transparent px-3 pt-6 pb-3">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {message.length}/5000
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className={cn(
                        "pointer-events-auto",
                        visibility === "INTERNAL" &&
                          "bg-amber-600 text-white shadow-amber-600/15 hover:bg-amber-600/90"
                      )}
                      disabled={
                        Boolean(pendingAction) ||
                        publicReplyDisabled ||
                        message.trim().length < 2
                      }
                      onClick={() => void submitMessage()}
                    >
                      <HugeiconsIcon
                        icon={
                          pendingAction === "message"
                            ? Loading03Icon
                            : visibility === "INTERNAL"
                              ? NoteIcon
                              : SentIcon
                        }
                        className={cn(
                          "size-3.5",
                          pendingAction === "message" && "animate-spin"
                        )}
                      />
                      {pendingAction === "message"
                        ? "Kaydediliyor"
                        : visibility === "INTERNAL"
                          ? "Not ekle"
                          : "Yanıtı gönder"}
                    </Button>
                  </div>
                </div>
              </div>

              {error ? (
                <p className="mt-2 px-1 text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </footer>
        </section>

        <aside className="w-full shrink-0 border-t border-border bg-muted/15 lg:sticky lg:top-0 lg:h-full lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <div className="space-y-6 p-5">
            <DetailSection title="İşlem">
              <LabeledControl label="Durum">
                <Select
                  value={ticket.status}
                  disabled={Boolean(pendingAction)}
                  onValueChange={(value) =>
                    void changeStatus(value as SupportTicketStatus)
                  }
                >
                  <SelectTrigger className="w-full rounded-xl border-border bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {ADMIN_SUPPORT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledControl>

              <LabeledControl label="Sorumlu">
                <Select
                  value={ticket.assignedAdmin?.id ?? UNASSIGNED}
                  disabled={Boolean(pendingAction)}
                  onValueChange={(value) => void changeAssignee(value)}
                >
                  <SelectTrigger className="w-full rounded-xl border-border bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value={UNASSIGNED}>Atanmamış</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledControl>
            </DetailSection>

            <DetailSection title="Müşteri">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarImage src={ticket.createdBy?.image ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(ticket.createdBy?.name ?? "Kullanıcı")}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {ticket.createdBy?.name ?? "Silinmiş kullanıcı"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {ticket.createdBy?.email ?? "E-posta bulunmuyor"}
                  </p>
                </div>
              </div>
            </DetailSection>

            <DetailSection title="Talep bilgileri">
              <DetailRow label="Çalışma alanı" value={ticket.workspace.name} />
              <DetailRow label="Mağaza" value={ticket.store?.name ?? "—"} />
              <DetailRow
                label="Kategori"
                value={getSupportCategoryLabel(ticket.category)}
              />
              <DetailRow label="Plan" value={ticket.planSnapshot} />
              <DetailRow
                label="İlk yanıt hedefi"
                value={
                  ticket.firstRespondedAt
                    ? "Yanıtlandı"
                    : formatAdminSupportDate(ticket.firstResponseDueAt)
                }
                danger={
                  !ticket.firstRespondedAt &&
                  new Date(ticket.firstResponseDueAt).getTime() < referenceTime
                }
              />
              {ticket.context?.pagePath ? (
                <DetailRow
                  label="Kaynak sayfa"
                  value={ticket.context.pagePath}
                />
              ) : null}
            </DetailSection>
          </div>
        </aside>
      </div>
    </div>
  )
}

function AdminMessageBubble({ message }: { message: AdminSupportMessage }) {
  if (message.isInternal) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-xl border border-amber-500/25 bg-amber-500/7 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
          <HugeiconsIcon icon={NoteIcon} className="size-3.5" />
          Dahili not · {message.author?.name ?? "Destek ekibi"}
          <span className="ml-auto font-normal text-muted-foreground">
            {formatAdminSupportDate(message.createdAt)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-5 whitespace-pre-wrap">
          {message.body}
        </p>
      </div>
    )
  }

  if (message.authorType === "SYSTEM") {
    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground">
          {message.body}
        </span>
      </div>
    )
  }

  const isSupport = message.authorType === "SUPPORT"
  const name = isSupport
    ? (message.author?.name ?? "Destek ekibi")
    : (message.author?.name ?? "Kullanıcı")

  return (
    <div
      className={cn(
        "flex items-end gap-2.5",
        isSupport ? "justify-end" : "justify-start"
      )}
    >
      {!isSupport ? (
        <Avatar className="size-8">
          <AvatarImage src={message.author?.image ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
      ) : null}
      <div className={cn("max-w-[78%]", isSupport && "text-right")}>
        <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className={isSupport ? "ml-auto" : undefined}>{name}</span>
          <span>{formatAdminSupportDate(message.createdAt)}</span>
        </div>
        <div
          className={cn(
            "rounded-2xl border px-3.5 py-2.5 text-left text-sm leading-5 whitespace-pre-wrap",
            isSupport
              ? "rounded-br-md border-primary/15 bg-primary text-primary-foreground"
              : "rounded-bl-md border-border bg-card text-foreground shadow-xs"
          )}
        >
          {message.body}
        </div>
      </div>
      {isSupport ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={CustomerSupportIcon} className="size-3.5" />
        </span>
      ) : null}
    </div>
  )
}

function ComposerModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors",
        active && "bg-card text-foreground shadow-xs"
      )}
    >
      {children}
    </button>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border-b border-border pb-6 last:border-b-0 last:pb-0">
      <h2 className="mb-3 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function LabeledControl({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function DetailRow({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right font-medium break-words",
          danger && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  )
}
