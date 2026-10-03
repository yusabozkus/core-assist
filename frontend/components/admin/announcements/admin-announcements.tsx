"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Notification01Icon,
  PlusSignIcon,
  RefreshIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { APP_ROUTES } from "@/constants/site"
import { ApiError } from "@/lib/api/client"
import {
  previewAdminAnnouncement,
  publishAdminAnnouncement,
} from "@/lib/api/admin-announcements"
import { cn } from "@/lib/utils"
import {
  ANNOUNCEMENT_ROLES,
  type AdminAnnouncement,
  type AnnouncementInput,
  type AnnouncementList,
  type AnnouncementRole,
} from "@/types/admin-announcement"
import { formatEmailDate } from "../emails/admin-email-presentation"

const roles = Object.keys(ANNOUNCEMENT_ROLES) as AnnouncementRole[]

export function AdminAnnouncements({
  data,
  query,
}: {
  data: AnnouncementList
  query: { q?: string; page: number }
}) {
  const router = useRouter()
  const [search, setSearch] = useState(query.q ?? "")
  const [navigationPending, startNavigation] = useTransition()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<AnnouncementRole[]>([])
  const [sendEmail, setSendEmail] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState("")
  const publishingRef = useRef(false)
  const preparedRef = useRef<{ id: string; input: string } | null>(null)
  const allRolesSelected = selectedRoles.length === roles.length

  function searchAnnouncements() {
    const normalized = search.trim()
    if (normalized === (query.q ?? "") && query.page === 1) return
    const params = new URLSearchParams()
    if (normalized) params.set("q", normalized)
    const url =
      APP_ROUTES.admin.announcements + (params.size ? "?" + params : "")
    startNavigation(() => router.push(url, { scroll: false }))
  }

  function goToPage(page: number) {
    const params = new URLSearchParams()
    if (query.q) params.set("q", query.q)
    if (page > 1) params.set("page", String(page))
    const url =
      APP_ROUTES.admin.announcements + (params.size ? "?" + params : "")
    startNavigation(() => router.push(url, { scroll: false }))
  }

  function resetForm() {
    setTitle("")
    setMessage("")
    setSelectedRoles([])
    setSendEmail(false)
    setError("")
    preparedRef.current = null
  }

  async function publish() {
    if (
      publishingRef.current ||
      !title.trim() ||
      !message.trim() ||
      !selectedRoles.length
    )
      return

    publishingRef.current = true
    setPublishing(true)
    setError("")
    const input: AnnouncementInput = {
      title: title.trim(),
      message: message.trim(),
      roles: selectedRoles,
      sendEmail,
    }
    const inputKey = JSON.stringify(input)
    try {
      let id =
        preparedRef.current?.input === inputKey ? preparedRef.current.id : null
      if (!id) {
        const prepared = await previewAdminAnnouncement(input)
        id = prepared.id
        preparedRef.current = { id, input: inputKey }
      }
      const result = await publishAdminAnnouncement(id)
      toast.success(
        String(result.recipientCount) +
          " kişiye bildirim oluşturuldu." +
          (result.sendEmail
            ? " " +
              String(result.emailCount) +
              " e-posta gönderim sırasına alındı."
            : "")
      )
      resetForm()
      setDrawerOpen(false)
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Duyuru yayımlanamadı. Lütfen yeniden deneyin."
      )
      if (cause instanceof ApiError && [400, 404, 409].includes(cause.status))
        preparedRef.current = null
    } finally {
      publishingRef.current = false
      setPublishing(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Duyurular
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Müşteri ekiplerine gönderilen duyuruları görüntüleyin ve yönetin.
          </p>
        </div>
        <Button type="button" onClick={() => setDrawerOpen(true)}>
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          Yeni duyuru
        </Button>
      </header>

      <section className="mt-8" aria-label="Duyuru listesi">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Gönderim geçmişi</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.pagination.total.toLocaleString("tr-TR")} duyuru
              {query.q ? " bulundu" : " yayımlandı"}
            </p>
          </div>
          <Link
            href={APP_ROUTES.admin.emails}
            className="text-xs font-medium text-primary hover:underline"
          >
            E-posta geçmişi
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 sm:p-4">
            <form
              className="flex min-w-[220px] flex-1 gap-2 sm:max-w-lg"
              onSubmit={(event) => {
                event.preventDefault()
                searchAnnouncements()
              }}
            >
              <Input
                aria-label="Duyurularda ara"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                maxLength={120}
                placeholder="Başlık veya mesajda ara..."
                icon={<HugeiconsIcon icon={Search01Icon} className="size-4" />}
                className="h-10 bg-background shadow-none"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={navigationPending}
                className="h-10"
              >
                Ara
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => router.refresh()}
              disabled={navigationPending}
              aria-label="Duyuruları yenile"
              title="Duyuruları yenile"
              className="size-10"
            >
              <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            </Button>
          </div>

          {data.items.length ? (
            <div className="divide-y divide-border">
              {data.items.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <HugeiconsIcon icon={Notification01Icon} className="size-5" />
              </span>
              <p className="mt-4 text-sm font-medium">
                {query.q ? "Eşleşen duyuru bulunamadı" : "Henüz duyuru yok"}
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                {query.q
                  ? "Başka bir başlık veya mesaj içeriği arayın."
                  : "İlk duyurunuzu oluşturmak için Yeni duyuru butonunu kullanın."}
              </p>
            </div>
          )}

          {data.pagination.totalPages > 1 || data.pagination.page > 1 ? (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
              <span>
                Sayfa {data.pagination.page} / {data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={navigationPending || data.pagination.page <= 1}
                  onClick={() => goToPage(data.pagination.page - 1)}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                  Önceki
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    navigationPending ||
                    data.pagination.page >= data.pagination.totalPages
                  }
                  onClick={() => goToPage(data.pagination.page + 1)}
                >
                  Sonraki
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!publishing) setDrawerOpen(open)
        }}
      >
        <SheetContent
          side="right"
          className="p-0 data-[side=right]:w-full! data-[side=right]:sm:max-w-xl!"
        >
          <SheetHeader className="shrink-0 border-b border-border px-6 py-5 pr-16">
            <SheetTitle>Yeni duyuru</SheetTitle>
            <SheetDescription>
              Mesajı ve alıcıları seçip yayımlayın.
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              void publish()
            }}
          >
            <fieldset
              disabled={publishing}
              className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6"
            >
              <legend className="sr-only">Duyuru bilgileri</legend>
              <div className="space-y-2">
                <label
                  htmlFor="announcement-title"
                  className="text-sm font-medium"
                >
                  Başlık
                </label>
                <Input
                  id="announcement-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="Örn. Planlı bakım"
                  className="h-10 bg-background shadow-none"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="announcement-message"
                    className="text-sm font-medium"
                  >
                    Mesaj
                  </label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {message.length}/1000
                  </span>
                </div>
                <Textarea
                  id="announcement-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1000}
                  required
                  rows={6}
                  placeholder="Müşterilere iletmek istediğiniz bilgiyi yazın..."
                  className="min-h-36 resize-y bg-background shadow-none"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Alıcılar</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Duyuru seçilen rollere gönderilir.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={
                        allRolesSelected
                          ? true
                          : selectedRoles.length
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) =>
                        setSelectedRoles(checked === true ? [...roles] : [])
                      }
                    />
                    Tümünü seç
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roles.map((role) => {
                    const selected = selectedRoles.includes(role)
                    return (
                      <label
                        key={role}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                          selected
                            ? "border-primary/35 bg-primary/5"
                            : "border-border hover:bg-muted/30"
                        )}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) =>
                            setSelectedRoles((current) =>
                              checked
                                ? [...current, role]
                                : current.filter((item) => item !== role)
                            )
                          }
                        />
                        {ANNOUNCEMENT_ROLES[role]}
                      </label>
                    )
                  })}
                </div>
                {!selectedRoles.length ? (
                  <p className="text-xs text-muted-foreground">
                    Yayımlamak için en az bir rol seçin.
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
                <div>
                  <label
                    htmlFor="announcement-email"
                    className="text-sm font-medium"
                  >
                    E-posta da gönder
                  </label>
                  <p
                    id="announcement-email-help"
                    className="mt-0.5 text-xs leading-5 text-muted-foreground"
                  >
                    {data.emailAvailable
                      ? "Panel bildirimine ek olarak doğrulanmış adreslere e-posta gönderilir."
                      : "E-posta gönderimi şu anda kullanılamıyor."}
                  </p>
                </div>
                <Switch
                  id="announcement-email"
                  aria-describedby="announcement-email-help"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                  disabled={!data.emailAvailable || publishing}
                />
              </div>
            </fieldset>

            <SheetFooter className="shrink-0 border-t border-border bg-card px-6 py-4">
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Panel bildirimi gönderilir.
                </p>
                <Button
                  type="submit"
                  disabled={
                    publishing ||
                    !title.trim() ||
                    !message.trim() ||
                    !selectedRoles.length
                  }
                >
                  {publishing ? "Yayımlanıyor…" : "Duyuruyu yayımla"}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </main>
  )
}
function HistoryRow({ item }: { item: AdminAnnouncement }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/35 sm:gap-4 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <HugeiconsIcon icon={Notification01Icon} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <time dateTime={item.publishedAt ?? undefined}>
              {formatEmailDate(item.publishedAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span>
              {item.roles.length === roles.length
                ? "Tüm roller"
                : `${item.roles.length} rol`}
            </span>
            {item.sendEmail ? (
              <>
                <span aria-hidden="true">·</span>
                <span>E-posta açık</span>
              </>
            ) : null}
          </div>
        </div>
        <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
          <strong className="block text-sm font-semibold text-foreground tabular-nums">
            {item.recipientCount.toLocaleString("tr-TR")}
          </strong>
          bildirim
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-border bg-muted/15 px-5 py-5 sm:pl-18">
        <p className="max-w-3xl text-sm leading-6 break-words whitespace-pre-wrap">
          {item.message}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.roles.map((role) => (
            <Badge key={role} variant="outline" className="bg-card font-medium">
              {ANNOUNCEMENT_ROLES[role]}
            </Badge>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            {item.recipientCount.toLocaleString("tr-TR")} panel bildirimi
          </span>
          <span>
            {item.sendEmail
              ? `${item.emailCount.toLocaleString("tr-TR")} e-posta sıraya alındı`
              : "E-posta gönderimi kapalı"}
          </span>
          {item.skippedEmailCount > 0 ? (
            <span>{item.skippedEmailCount} doğrulanmamış adres atlandı</span>
          ) : null}
          {item.emailCount > 0 ? (
            <Link
              href={`${APP_ROUTES.admin.emails}?announcementId=${item.id}`}
              className="ml-auto inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              E-posta sonuçları{" "}
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>
    </details>
  )
}
