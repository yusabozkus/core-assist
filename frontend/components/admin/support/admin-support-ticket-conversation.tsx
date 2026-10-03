"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft01Icon,
  Calendar03Icon,
  CustomerSupportIcon,
  LinkSquare02Icon,
  Loading03Icon,
  Mail01Icon,
  NoteIcon,
  SentIcon,
  Store01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { HugeiconsIcon } from "@hugeicons/react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
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
  SupportImageAttachments,
  SupportImagePicker,
  SupportImagePreviews,
  handleSupportImagePaste,
  isLongSupportMessage,
  useSupportImageSelection,
  visibleSupportMessageBody,
} from "@/components/dashboard/support/support-image-attachments"
import { APP_ROUTES } from "@/constants/site"
import { useIsDesktop } from "@/hooks/use-desktop"
import {
  addAdminSupportMessage,
  addAdminSupportImageMessage,
  getAdminSupportTicket,
  updateAdminSupportAssignee,
  updateAdminSupportStatus,
} from "@/lib/api/admin-support"
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/api/notifications"
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
  const isDesktop = useIsDesktop()
  const [ticket, setTicket] = useState(initialTicket)
  const [referenceTime] = useState(() => Date.now())
  const [message, setMessage] = useState("")
  const { images, addImages, removeImage, clearImages } =
    useSupportImageSelection()
  const [visibility, setVisibility] = useState<"PUBLIC" | "INTERNAL">("PUBLIC")
  const [pendingAction, setPendingAction] = useState<
    "message" | "status" | "assignee" | null
  >(null)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const messagesViewportRef = useRef<HTMLElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  const hasScrolledRef = useRef(false)
  const mutationPendingRef = useRef(false)
  const refreshQueuedRef = useRef(false)
  const refreshRequestRef = useRef<AbortController | null>(null)
  const refreshVersionRef = useRef(0)
  const isClosed = ticket.status === "RESOLVED" || ticket.status === "CLOSED"
  const publicReplyDisabled = isClosed && visibility === "PUBLIC"

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
      const nextTicket = await getAdminSupportTicket(
        ticket.id,
        controller.signal
      )
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
    function toggleComposerMode(event: KeyboardEvent) {
      if (
        !["KeyS", "KeyN"].includes(event.code) ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat
      ) {
        return
      }

      event.preventDefault()
      if (mutationPendingRef.current) return
      setVisibility((current) => (current === "PUBLIC" ? "INTERNAL" : "PUBLIC"))
    }

    window.addEventListener("keydown", toggleComposerMode, true)
    return () => window.removeEventListener("keydown", toggleComposerMode, true)
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(
      () => void refreshTicket(),
      POLL_INTERVAL_MS
    )

    function handleVisible() {
      if (document.visibilityState === "visible") void refreshTicket()
    }

    function handleNotificationChange() {
      void refreshTicket()
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
  }, [cancelPendingRefresh, refreshTicket])

  async function submitMessage() {
    const value = message.trim()
    if (
      value.length === 1 ||
      (value.length === 0 && images.length === 0) ||
      pendingAction ||
      mutationPendingRef.current ||
      publicReplyDisabled
    ) {
      return
    }

    setMessageError(null)
    setPendingAction("message")
    mutationPendingRef.current = true
    cancelPendingRefresh()
    try {
      setTicket(
        images.length
          ? await addAdminSupportImageMessage(
              ticket.id,
              value,
              visibility,
              images.map((image) => image.file)
            )
          : await addAdminSupportMessage(ticket.id, value, visibility)
      )
      setMessage("")
      clearImages()
    } catch (caughtError) {
      setMessageError(
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

  async function changeStatus(status: SupportTicketStatus) {
    if (
      pendingAction ||
      mutationPendingRef.current ||
      status === ticket.status
    ) {
      return
    }
    setTicketError(null)
    setPendingAction("status")
    mutationPendingRef.current = true
    cancelPendingRefresh()
    try {
      setTicket(await updateAdminSupportStatus(ticket.id, status))
    } catch (caughtError) {
      setTicketError(
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

  async function changeAssignee(assigneeUserId: string) {
    if (pendingAction || mutationPendingRef.current) return
    setTicketError(null)
    setPendingAction("assignee")
    mutationPendingRef.current = true
    cancelPendingRefresh()
    try {
      setTicket(
        await updateAdminSupportAssignee(
          ticket.id,
          assigneeUserId === UNASSIGNED ? null : assigneeUserId
        )
      )
    } catch (caughtError) {
      setTicketError(
        caughtError instanceof Error
          ? caughtError.message
          : "Talep ataması güncellenemedi."
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

  const status = ADMIN_SUPPORT_STATUS[ticket.status]
  const priority = ADMIN_SUPPORT_PRIORITY[ticket.priority]

  return (
    <div className="flex min-h-svh flex-col bg-background lg:h-[calc(100svh-1rem)] lg:min-h-0 lg:overflow-hidden">
      <TicketPanelLayout
        isDesktop={Boolean(isDesktop)}
        inspector={
          <TicketInspector
            ticket={ticket}
            agents={agents}
            pending={Boolean(pendingAction)}
            referenceTime={referenceTime}
            error={ticketError}
            onStatusChange={changeStatus}
            onAssigneeChange={changeAssignee}
          />
        }
      >
        <section className="flex min-h-[620px] min-w-0 flex-1 flex-col lg:min-h-0">
          <header className="shrink-0 border-b border-border bg-background px-4 py-2.5 sm:px-8 sm:py-3 lg:flex lg:h-20 lg:items-center">
            <div className="flex w-full min-w-0 items-start gap-2.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => router.back()}
                aria-label="Destek taleplerine dön"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                      {ticket.subject}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                        {ticket.code}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-2 py-0 text-[10px]",
                          status.className
                        )}
                      >
                        {status.label}
                      </Badge>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          priority.className
                        )}
                      >
                        {priority.label} öncelik
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-x-3 text-right text-[10px] leading-4 text-muted-foreground sm:flex-col sm:items-end sm:gap-0">
                    <span className="font-medium text-foreground">
                      {ticket.messageCount} mesaj
                    </span>
                    <span>
                      {formatAdminSupportDate(ticket.createdAt)} tarihinde
                      açıldı
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main
            ref={messagesViewportRef}
            className="themed-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-7 sm:px-8"
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
              {ticket.messages.map((item) => (
                <AdminMessageBubble
                  key={item.id}
                  message={item}
                  ticketId={ticket.id}
                />
              ))}
            </div>
          </main>

          <footer className="sticky bottom-0 z-10 shrink-0 bg-transparent px-4 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-[max(0.875rem,env(safe-area-inset-bottom))] lg:static">
            <div className="mx-auto w-full max-w-4xl">
              <div
                className={cn(
                  "relative rounded-2xl border bg-card shadow-sm transition-[border-color,box-shadow] focus-within:shadow-md",
                  visibility === "INTERNAL"
                    ? "border-amber-500/30 focus-within:border-amber-500/50"
                    : "border-border focus-within:border-primary/35"
                )}
              >
                <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 flex flex-col gap-2 pb-2">
                  {publicReplyDisabled ? (
                    <p className="w-fit max-w-full rounded-md bg-background/95 px-2 py-1 text-[11px] text-amber-700 shadow-sm dark:text-amber-400">
                      Kullanıcıya yanıt vermek için talebi yeniden açın. Dahili
                      not eklemeye devam edebilirsiniz.
                    </p>
                  ) : null}
                  <SupportImagePreviews
                    images={images}
                    onRemove={removeImage}
                    disabled={Boolean(pendingAction) || publicReplyDisabled}
                    floating={false}
                  />
                </div>
                <div className="relative overflow-hidden rounded-2xl">
                  <Textarea
                    ref={messageInputRef}
                    value={message}
                    maxLength={5000}
                    rows={2}
                    disabled={Boolean(pendingAction) || publicReplyDisabled}
                    onChange={(event) => setMessage(event.target.value)}
                    onPaste={(event) =>
                      handleSupportImagePaste(event, addImages, setMessageError)
                    }
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
                    <div className="pointer-events-auto flex items-center gap-1">
                      <SupportImagePicker
                        count={images.length}
                        onSelect={addImages}
                        onError={setMessageError}
                        disabled={Boolean(pendingAction) || publicReplyDisabled}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={Boolean(pendingAction)}
                            aria-label={`Yanıt türü: ${visibility === "INTERNAL" ? "Dahili not" : "Kullanıcıya yanıt"}. Değiştir`}
                            aria-keyshortcuts="Alt+S Alt+N"
                            title={`${visibility === "INTERNAL" ? "Dahili not" : "Kullanıcıya yanıt"} · Alt+S veya Alt+N ile değiştir`}
                            className={cn(
                              "flex h-8 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50",
                              visibility === "INTERNAL" &&
                                "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            <HugeiconsIcon
                              icon={
                                visibility === "INTERNAL"
                                  ? NoteIcon
                                  : CustomerSupportIcon
                              }
                              className="size-4.5"
                            />
                            <span className="text-xs font-medium whitespace-nowrap">
                              {visibility === "INTERNAL"
                                ? "Dahili not"
                                : "Kullanıcıya yanıt"}
                            </span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="top"
                          align="start"
                          sideOffset={10}
                        >
                          <DropdownMenuRadioGroup
                            value={visibility}
                            onValueChange={(value) =>
                              setVisibility(value as "PUBLIC" | "INTERNAL")
                            }
                          >
                            <DropdownMenuRadioItem value="PUBLIC">
                              <HugeiconsIcon
                                icon={CustomerSupportIcon}
                                className="size-4"
                              />
                              Kullanıcıya yanıt
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="INTERNAL">
                              <HugeiconsIcon
                                icon={NoteIcon}
                                className="size-4"
                              />
                              Dahili not
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
                        message.trim().length === 1 ||
                        (message.trim().length === 0 && images.length === 0)
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

              {messageError ? (
                <p className="mt-2 px-1 text-xs text-destructive" role="alert">
                  {messageError}
                </p>
              ) : null}
            </div>
          </footer>
        </section>
      </TicketPanelLayout>
    </div>
  )
}

function TicketPanelLayout({
  isDesktop,
  inspector,
  children,
}: {
  isDesktop: boolean
  inspector: React.ReactNode
  children: React.ReactNode
}) {
  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <details className="shrink-0 border-b border-border">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-muted-foreground marker:text-muted-foreground">
            Talep bilgileri ve işlemler
          </summary>
          <div className="h-[min(60svh,32rem)] border-t border-border">
            {inspector}
          </div>
        </details>
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-0 w-full flex-1 overflow-hidden">
      <ResizablePanelGroup
        id="admin-support-ticket-layout"
        orientation="horizontal"
        className="min-h-0"
      >
        <ResizablePanel id="ticket-conversation" minSize="28rem">
          <div className="flex h-full min-w-0 flex-col">{children}</div>
        </ResizablePanel>
        <ResizableHandle
          withHandle
          className="bg-border/70 transition-colors hover:bg-primary/45 focus-visible:bg-primary/45"
        />
        <ResizablePanel
          id="ticket-inspector"
          defaultSize="19rem"
          minSize="14rem"
          maxSize="27rem"
          groupResizeBehavior="preserve-pixel-size"
        >
          {inspector}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

function TicketInspector({
  ticket,
  agents,
  pending,
  referenceTime,
  error,
  onStatusChange,
  onAssigneeChange,
}: {
  ticket: AdminSupportTicketDetail
  agents: AdminSupportPerson[]
  pending: boolean
  referenceTime: number
  error: string | null
  onStatusChange: (status: SupportTicketStatus) => Promise<void>
  onAssigneeChange: (userId: string) => Promise<void>
}) {
  const firstResponseOverdue =
    !ticket.firstRespondedAt &&
    new Date(ticket.firstResponseDueAt).getTime() < referenceTime

  return (
    <aside className="themed-scrollbar h-full min-w-0 overflow-y-auto bg-muted/12">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border bg-background px-4 py-2.5 sm:py-3 lg:flex lg:h-20 lg:flex-col lg:justify-center">
        <h2 className="text-base font-semibold tracking-tight sm:text-lg">
          Talep bilgileri
        </h2>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Müşteri ve işlemler
        </p>
      </div>
      <section className="border-b border-border p-4">
        <p className="text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Müşteri
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={ticket.createdBy?.image ?? undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(ticket.createdBy?.name ?? "Kullanıcı")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {ticket.createdBy ? (
              <Link
                href={APP_ROUTES.admin.customer(ticket.workspace.id)}
                className="block truncate text-sm font-semibold underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline"
              >
                {ticket.createdBy.name}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold">
                Silinmiş kullanıcı
              </p>
            )}
            {ticket.createdBy?.email ? (
              <a
                href={`mailto:${ticket.createdBy.email}`}
                className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <HugeiconsIcon icon={Mail01Icon} className="size-3 shrink-0" />
                <span className="truncate">{ticket.createdBy.email}</span>
              </a>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                E-posta bulunmuyor
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-border p-4">
        <p className="text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          İşlem
        </p>
        <div className="mt-3 grid gap-3">
          <TicketControl label="Durum">
            <Select
              value={ticket.status}
              disabled={pending}
              onValueChange={(value) =>
                void onStatusChange(value as SupportTicketStatus)
              }
            >
              <SelectTrigger className="h-9 w-full rounded-lg border-border bg-background text-xs shadow-none">
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
          </TicketControl>

          <TicketControl label="Sorumlu">
            <Select
              value={ticket.assignedAdmin?.id ?? UNASSIGNED}
              disabled={pending}
              onValueChange={(value) => void onAssigneeChange(value)}
            >
              <SelectTrigger className="h-9 w-full rounded-lg border-border bg-background text-xs shadow-none">
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
          </TicketControl>
        </div>

        {error ? (
          <p className="mt-3 text-xs leading-5 text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="p-4">
        <p className="text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Talep ayrıntıları
        </p>
        <dl className="mt-1 divide-y divide-border/70">
          <InspectorDetail
            label="Mağaza"
            value={ticket.store?.name ?? "Mağaza bulunmuyor"}
            href={
              ticket.store
                ? `${APP_ROUTES.admin.customer(ticket.workspace.id)}#store-${ticket.store.id}`
                : undefined
            }
            icon={Store01Icon}
          />
          <InspectorDetail
            label="Kategori"
            value={getSupportCategoryLabel(ticket.category)}
            icon={CustomerSupportIcon}
          />
          <InspectorDetail
            label="Plan"
            value={formatPlanName(ticket.planSnapshot)}
          />
          <InspectorDetail
            label="İlk yanıt"
            value={
              ticket.firstRespondedAt
                ? "Yanıtlandı"
                : formatAdminSupportDate(ticket.firstResponseDueAt)
            }
            icon={Calendar03Icon}
            danger={firstResponseOverdue}
          />
          {ticket.context?.pagePath ? (
            <InspectorDetail
              label="Kaynak sayfa"
              value={ticket.context.pagePath}
              icon={LinkSquare02Icon}
              mono
            />
          ) : null}
        </dl>
      </section>
    </aside>
  )
}

function AdminMessageBubble({
  message,
  ticketId,
}: {
  message: AdminSupportMessage
  ticketId: string
}) {
  const visibleBody = visibleSupportMessageBody(
    message.body,
    message.attachments
  )
  const hasImages = message.attachments.length > 0
  const expanded = isLongSupportMessage(visibleBody)
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
        {visibleBody && hasImages ? (
          <div
            className={cn(
              "mt-2 max-w-full overflow-hidden rounded-xl border border-amber-500/25",
              expanded ? "w-[min(36rem,85vw)]" : "w-[min(20rem,75vw)]"
            )}
          >
            <SupportImageAttachments
              ticketId={ticketId}
              attachments={message.attachments}
              admin
              embedded
              expanded={expanded}
            />
            <p className="px-3.5 py-2.5 text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
              {visibleBody}
            </p>
          </div>
        ) : visibleBody ? (
          <p className="mt-2 text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
            {visibleBody}
          </p>
        ) : null}
        {!visibleBody && hasImages ? (
          <div className="mt-2">
            <SupportImageAttachments
              ticketId={ticketId}
              attachments={message.attachments}
              admin
            />
          </div>
        ) : null}
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
        {visibleBody && hasImages ? (
          <div
            className={cn(
              "max-w-full overflow-hidden rounded-2xl border text-left",
              expanded ? "w-[min(36rem,85vw)]" : "w-[min(20rem,75vw)]",
              isSupport
                ? "rounded-br-md border-primary/15"
                : "rounded-bl-md border-border shadow-xs"
            )}
          >
            <SupportImageAttachments
              ticketId={ticketId}
              attachments={message.attachments}
              admin
              embedded
              expanded={expanded}
            />
            <div
              className={cn(
                "px-3.5 py-2.5 text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap",
                isSupport
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              )}
            >
              {visibleBody}
            </div>
          </div>
        ) : visibleBody ? (
          <div
            className={cn(
              "rounded-2xl border px-3.5 py-2.5 text-left text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap",
              isSupport
                ? "rounded-br-md border-primary/15 bg-primary text-primary-foreground"
                : "rounded-bl-md border-border bg-card text-foreground shadow-xs"
            )}
          >
            {visibleBody}
          </div>
        ) : null}
        {!visibleBody && hasImages ? (
          <SupportImageAttachments
            ticketId={ticketId}
            attachments={message.attachments}
            admin
          />
        ) : null}
      </div>
      {isSupport ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={CustomerSupportIcon} className="size-3.5" />
        </span>
      ) : null}
    </div>
  )
}

function TicketControl({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="block px-0.5 text-[9px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

function InspectorDetail({
  label,
  value,
  href,
  danger = false,
  mono = false,
  icon,
}: {
  label: string
  value: string
  href?: string
  danger?: boolean
  mono?: boolean
  icon?: IconSvgElement
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border/70 ring-inset">
        {icon ? (
          <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5" />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            "mt-0.5 text-xs font-medium break-words",
            mono && "font-mono text-[10px]",
            danger && "text-destructive"
          )}
        >
          {href ? (
            <Link
              href={href}
              className="underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline"
            >
              {value}
            </Link>
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  )
}

function formatPlanName(plan: AdminSupportTicketDetail["planSnapshot"]) {
  return { STARTER: "Starter", GROWTH: "Growth", BUSINESS: "Business" }[plan]
}
