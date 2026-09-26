"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Mail01Icon,
  Notification01Icon,
  RefreshIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
  type AnnouncementList,
  type AnnouncementPreview,
  type AnnouncementRole,
} from "@/types/admin-announcement"
import { formatEmailDate } from "../emails/admin-email-presentation"

const roles = Object.keys(ANNOUNCEMENT_ROLES) as AnnouncementRole[]
const roleDescriptions: Record<AnnouncementRole, string> = {
  OWNER: "Müşteri hesabının sahibi",
  ACCOUNT_ADMIN: "Tüm hesabı yöneten ekip üyeleri",
  STORE_ADMIN: "Atandığı mağazaları yönetenler",
  AGENT: "Mağazada işlem yapan temsilciler",
  VIEWER: "Görüntüleme yetkisi olanlar",
}

export function AdminAnnouncements({ data }: { data: AnnouncementList }) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<AnnouncementRole[]>([])
  const [sendEmail, setSendEmail] = useState(false)
  const [preview, setPreview] = useState<AnnouncementPreview | null>(null)
  const [pending, setPending] = useState<"preview" | "publish" | null>(null)
  const [error, setError] = useState("")
  const allRolesSelected = selectedRoles.length === roles.length

  async function preparePreview() {
    if (pending) return
    setPending("preview")
    setError("")
    try {
      setPreview(
        await previewAdminAnnouncement({
          title: title.trim(),
          message: message.trim(),
          roles: selectedRoles,
          sendEmail,
        })
      )
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Önizleme oluşturulamadı."
      )
    } finally {
      setPending(null)
    }
  }

  async function publish() {
    if (!preview || pending) return
    setPending("publish")
    setError("")
    try {
      const result = await publishAdminAnnouncement(preview.id)
      toast.success(
        `${result.recipientCount} kişiye bildirim oluşturuldu.${result.sendEmail ? ` ${result.emailCount} e-posta gönderim sırasına alındı.` : ""}`
      )
      setPreview(null)
      setTitle("")
      setMessage("")
      setSelectedRoles([])
      setSendEmail(false)
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Gönderim sonucu alınamadı. Aynı önizlemeden tekrar deneyebilirsiniz."
      )
      if (cause instanceof ApiError && [400, 404, 409].includes(cause.status))
        setPreview(null)
    } finally {
      setPending(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-primary uppercase">
            Müşteri iletişimi
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Duyurular
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Müşteri ekiplerini rollerine göre bilgilendirin. Panel bildirimi
            oluşturun, gerekirse aynı duyuruyu e-postayla iletin.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={APP_ROUTES.admin.emails}>
            <HugeiconsIcon icon={Mail01Icon} className="size-4" />
            E-posta geçmişi
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </Link>
        </Button>
      </header>

      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.9fr)]">
        <form
          className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
          onSubmit={(event) => {
            event.preventDefault()
            void preparePreview()
          }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border bg-muted/25 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <HugeiconsIcon icon={Notification01Icon} className="size-4.5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Yeni duyuru</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  İçeriği, alıcıları ve gönderim kanalını belirleyin.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-card text-muted-foreground">
              Taslak
            </Badge>
          </div>

          <fieldset
            disabled={Boolean(pending)}
            className="border-b border-border px-5 py-6 sm:px-6"
          >
            <legend className="sr-only">Duyuru içeriği</legend>
            <SectionHeading
              number="01"
              title="İçerik"
              description="Müşterilerin panelde ve e-postada göreceği metin."
            />
            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="announcement-title"
                  className="text-xs font-medium"
                >
                  Başlık <span className="text-destructive">*</span>
                </label>
                <Input
                  id="announcement-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="Örn. Planlı bakım bilgilendirmesi"
                  className="h-10 bg-background shadow-none"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between gap-3">
                  <label
                    htmlFor="announcement-message"
                    className="text-xs font-medium"
                  >
                    Mesaj <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {message.length} / 1000
                  </span>
                </div>
                <Textarea
                  id="announcement-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1000}
                  required
                  rows={6}
                  placeholder="Ne olduğunu ve müşterilerin bilmesi gerekenleri açıkça yazın."
                  className="min-h-40 resize-y rounded-lg border-border bg-background shadow-none"
                />
              </div>
            </div>
          </fieldset>

          <fieldset
            disabled={Boolean(pending)}
            className="border-b border-border px-5 py-6 sm:px-6"
          >
            <legend className="sr-only">Alıcı rolleri</legend>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading
                number="02"
                title="Alıcılar"
                description="Duyuru yalnızca seçilen rollerdeki kişilere ulaşır."
              />
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="announcement-all-roles"
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
                <label
                  htmlFor="announcement-all-roles"
                  className="cursor-pointer text-xs font-medium"
                >
                  Hepsini seç
                </label>
              </div>
            </div>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {roles.map((role) => {
                const selected = selectedRoles.includes(role)
                return (
                  <div
                    key={role}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3.5 transition-colors",
                      selected
                        ? "border-primary/35 bg-primary/5"
                        : "border-border bg-background hover:border-primary/20 hover:bg-muted/30"
                    )}
                  >
                    <Checkbox
                      id={`announcement-role-${role}`}
                      checked={selected}
                      onCheckedChange={(checked) =>
                        setSelectedRoles((current) =>
                          checked
                            ? [...current, role]
                            : current.filter((item) => item !== role)
                        )
                      }
                      className="mt-0.5"
                    />
                    <label
                      htmlFor={`announcement-role-${role}`}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="block text-sm font-medium">
                        {ANNOUNCEMENT_ROLES[role]}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {roleDescriptions[role]}
                      </span>
                    </label>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Tüm müşteri hesapları kapsanır. Bir kişi birden fazla mağazada
              olsa da tek bildirim alır. Sistem adminleri alıcı değildir.
            </p>
          </fieldset>

          <fieldset disabled={Boolean(pending)} className="px-5 py-6 sm:px-6">
            <legend className="sr-only">Gönderim kanalları</legend>
            <SectionHeading
              number="03"
              title="Gönderim kanalları"
              description="Panel bildirimi her duyuruda kullanılır; e-posta isteğe bağlıdır."
            />
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HugeiconsIcon
                    icon={Notification01Icon}
                    className="size-4.5"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Panel bildirimi</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Seçilen kişilerin bildirim merkezinde görünür.
                  </p>
                </div>
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="size-4.5 shrink-0 text-primary"
                />
              </div>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3.5",
                  sendEmail
                    ? "border-primary/35 bg-primary/5"
                    : "border-border bg-background"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    sendEmail
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <HugeiconsIcon icon={Mail01Icon} className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="announcement-email"
                    className="cursor-pointer text-sm font-medium"
                  >
                    E-posta da gönder
                  </label>
                  <p
                    id="announcement-email-help"
                    className="mt-0.5 text-xs leading-5 text-muted-foreground"
                  >
                    {data.emailAvailable
                      ? "Doğrulanmış e-posta adreslerine ayrıca gönderilir."
                      : "E-posta yapılandırması eksik; yalnızca panel bildirimi kullanılabilir."}
                  </p>
                </div>
                <Switch
                  id="announcement-email"
                  aria-describedby="announcement-email-help"
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                  disabled={!data.emailAvailable || Boolean(pending)}
                />
              </div>
            </div>
          </fieldset>

          <div className="flex flex-col gap-4 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-muted-foreground">
              Sonraki adımda alıcı sayısını görüp gönderimi onaylayacaksınız.
            </p>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={
                Boolean(pending) ||
                !selectedRoles.length ||
                !title.trim() ||
                !message.trim()
              }
            >
              {pending === "preview"
                ? "Alıcılar hesaplanıyor…"
                : "Alıcıları önizle"}
              {pending !== "preview" ? (
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
              ) : null}
            </Button>
          </div>
          {error && !preview ? (
            <p
              role="alert"
              className="border-t border-border px-5 py-3 text-sm text-destructive sm:px-6"
            >
              {error}
            </p>
          ) : null}
        </form>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Canlı önizleme</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Panel bildirimindeki görünüm
                </p>
              </div>
              <Badge variant="secondary" className="font-medium">
                Taslak
              </Badge>
            </div>
            <div className="bg-muted/35 p-5">
              <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon
                      icon={Notification01Icon}
                      className="size-4.5"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-primary">
                        Core Asistan duyurusu
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        Şimdi
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold break-words">
                      {title.trim() || "Duyuru başlığı"}
                    </p>
                    <p className="mt-1 max-h-48 overflow-y-auto text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                      {message.trim() || "Mesajınız burada görünecek."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3 px-5 py-4 text-xs">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Alıcı rolü</span>
                <span className="max-w-[65%] text-right font-medium">
                  {selectedRoles.length
                    ? allRolesSelected
                      ? "Tüm roller"
                      : selectedRoles
                          .map((role) => ANNOUNCEMENT_ROLES[role])
                          .join(", ")
                    : "Seçilmedi"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Kanallar</span>
                <span className="font-medium">
                  Bildirim{sendEmail ? " + e-posta" : ""}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-border bg-card p-4 text-xs leading-5 text-muted-foreground">
            <HugeiconsIcon
              icon={UserGroupIcon}
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            Gerçek alıcı sayısı, roller seçilip önizleme açıldığında hesaplanır.
          </div>
        </aside>
      </div>

      <section
        className="mt-10"
        aria-labelledby="announcements-history-heading"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="announcements-history-heading"
              className="text-base font-semibold"
            >
              Gönderim geçmişi
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Son 30 duyuru ve gönderim kapsamı.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.refresh()}
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
            Yenile
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {data.items.length ? (
            <div className="divide-y divide-border">
              {data.items.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <HugeiconsIcon icon={Notification01Icon} className="size-5" />
              </span>
              <p className="mt-4 text-sm font-medium">
                Henüz duyuru gönderilmedi
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                İlk duyurunuzu yukarıdaki formdan hazırlayıp alıcıları kontrol
                ederek yayımlayabilirsiniz.
              </p>
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setPreview(null)
            setError("")
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HugeiconsIcon icon={Notification01Icon} className="size-5" />
            </div>
            <DialogTitle>Gönderimi onayla</DialogTitle>
            <DialogDescription>
              İçeriği ve alıcı sayısını kontrol edin. Onayla dediğinizde duyuru
              yayımlanır.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-sm font-semibold break-words">
                  {preview.title}
                </p>
                <p className="mt-2 max-h-32 overflow-y-auto text-xs leading-5 break-words whitespace-pre-wrap text-muted-foreground">
                  {preview.message}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
                <div className="bg-card p-4">
                  <HugeiconsIcon
                    icon={Notification01Icon}
                    className="size-4 text-primary"
                  />
                  <p className="mt-3 text-2xl font-semibold tabular-nums">
                    {preview.recipientCount.toLocaleString("tr-TR")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Panel bildirimi
                  </p>
                </div>
                <div className="bg-card p-4">
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    className="size-4 text-primary"
                  />
                  <p className="mt-3 text-2xl font-semibold tabular-nums">
                    {preview.emailCount.toLocaleString("tr-TR")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {preview.sendEmail
                      ? "Sıraya alınacak e-posta"
                      : "E-posta kapalı"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium">Seçilen roller</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preview.roles.map((role) => (
                    <Badge
                      key={role}
                      variant="secondary"
                      className="font-medium"
                    >
                      {ANNOUNCEMENT_ROLES[role]}
                    </Badge>
                  ))}
                </div>
              </div>
              {preview.skippedEmailCount > 0 ? (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
                  {preview.skippedEmailCount} kişinin e-posta adresi
                  doğrulanmamış. Bu kişilere panel bildirimi ulaşacak.
                </p>
              ) : null}
              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium">
                  Örnek alıcılar{" "}
                  <span className="font-normal text-muted-foreground">
                    ({preview.sample.length} / {preview.recipientCount})
                  </span>
                </p>
                <ul className="mt-2 divide-y divide-border">
                  {preview.sample.map((user) => (
                    <li
                      key={user.email}
                      className="flex flex-col gap-0.5 py-2 text-xs sm:flex-row sm:justify-between sm:gap-3"
                    >
                      <span className="min-w-0 break-all">
                        {user.name} · {user.email}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {user.workspaceName} · {ANNOUNCEMENT_ROLES[user.role]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Önizleme {formatEmailDate(preview.expiresAt)} tarihine kadar
                geçerlidir.
              </p>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(pending)}
              onClick={() => setPreview(null)}
            >
              Düzenlemeye dön
            </Button>
            <Button disabled={Boolean(pending)} onClick={() => void publish()}>
              {pending === "publish"
                ? "Gönderim hazırlanıyor…"
                : "Duyuruyu yayımla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function SectionHeading({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-[11px] font-semibold text-muted-foreground tabular-nums">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
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
