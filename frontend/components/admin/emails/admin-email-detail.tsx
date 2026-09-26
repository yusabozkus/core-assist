import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { APP_ROUTES } from "@/constants/site"
import type { AdminEmailDetail as EmailDetail } from "@/types/admin-email"
import { AdminEmailRefresh } from "./admin-email-refresh"
import {
  EMAIL_DELIVERY_STATUS,
  EmailStatusBadges,
  emailTypeLabel,
  formatEmailDate,
} from "./admin-email-presentation"

export function AdminEmailDetail({ email }: { email: EmailDetail }) {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10">
      <Link
        href={APP_ROUTES.admin.emails}
        className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        E-postalara dön
      </Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {emailTypeLabel(email.emailType)}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words">
            {email.subject}
          </h1>
          <p className="my-3 text-sm break-all text-muted-foreground">
            {email.recipientEmail}
          </p>
          <EmailStatusBadges email={email} />
        </div>
        <AdminEmailRefresh />
      </div>
      {email.status === "REVIEW_REQUIRED" ? (
        <div
          role="status"
          className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6"
        >
          Gönderimin sonucu kesinleşmediği için otomatik denemeler durduruldu.
          Yeni bir gönderim oluşturmadan önce Resend kayıtlarını inceleyin.
        </div>
      ) : null}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Gönderim bilgileri</h2>
          <dl className="mt-4 space-y-4">
            <Fact label="Alıcı">{email.recipientEmail}</Fact>
            <Fact label="Gönderici">{email.senderEmail}</Fact>
            <Fact label="Müşteri hesabı">
              {email.workspace ? (
                <Link
                  className="text-primary hover:underline"
                  href={APP_ROUTES.admin.customer(email.workspace.id)}
                >
                  {email.workspace.name}
                </Link>
              ) : (
                "Hesapla ilişkilendirilmemiş"
              )}
            </Fact>
            <Fact label="Mağaza">
              {email.store ? (
                <Link
                  className="text-primary hover:underline"
                  href={`${APP_ROUTES.admin.emails}?storeId=${encodeURIComponent(email.store.id)}`}
                >
                  {email.store.name}
                </Link>
              ) : (
                "—"
              )}
            </Fact>
            <Fact label="Oluşturulma">{formatEmailDate(email.createdAt)}</Fact>
            <Fact label="Resend kabul zamanı">
              {formatEmailDate(email.sentAt)}
            </Fact>
            <Fact label="Resend mesaj kimliği">
              {email.providerMessageId ?? "Henüz oluşmadı"}
            </Fact>
          </dl>
        </section>
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Denemeler ve hatalar</h2>
          <dl className="mt-4 space-y-4">
            <Fact label="Deneme sayısı">{email.attemptCount}</Fact>
            <Fact label="İlk deneme">
              {formatEmailDate(email.firstAttemptAt)}
            </Fact>
            <Fact label="Son deneme">
              {formatEmailDate(email.lastAttemptAt)}
            </Fact>
            <Fact label="Planlanan deneme">
              {formatEmailDate(email.nextAttemptAt)}
            </Fact>
            <Fact label="Son hata kodu">{email.lastErrorCode ?? "—"}</Fact>
            <Fact label="Hata açıklaması">
              {email.lastErrorMessage ?? "Kayıtlı gönderim hatası yok."}
            </Fact>
          </dl>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            Geçici gönderim hataları otomatik olarak yeniden denenir. Teslimat
            sonuçları aşağıdaki olay geçmişinde gösterilir.
          </p>
        </section>
      </div>
      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <h2 className="text-sm font-semibold">Teslimat geçmişi</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Teslim edildi durumu, alıcının posta sunucusunun e-postayı kabul
            ettiğini gösterir. Okunma bilgisi içermez.
          </p>
        </div>
        {email.events.length ? (
          <ol className="divide-y divide-border">
            {email.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div>
                  <Badge
                    variant="outline"
                    className={EMAIL_DELIVERY_STATUS[event.status].className}
                  >
                    {EMAIL_DELIVERY_STATUS[event.status].label}
                  </Badge>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Sisteme ulaşma: {formatEmailDate(event.receivedAt)}
                  </p>
                </div>
                <time
                  dateTime={event.occurredAt}
                  className="text-xs text-muted-foreground"
                >
                  {formatEmailDate(event.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="p-6 text-sm leading-6 text-muted-foreground">
            Bu gönderim için henüz teslimat bildirimi alınmadı. Gönderim kabul
            edilmiş olsa da teslimat sonucu şu anda bilinmiyor.
          </p>
        )}
        {email.eventCount > email.events.length ? (
          <p className="border-t border-border p-4 text-xs text-muted-foreground">
            {email.eventCount} olayın son {email.events.length} kaydı
            gösteriliyor.
          </p>
        ) : null}
      </section>
    </main>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 text-xs sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium [overflow-wrap:anywhere] break-words">
        {children}
      </dd>
    </div>
  )
}
