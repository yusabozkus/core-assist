import Link from "next/link"
import { APP_ROUTES } from "@/constants/site"
import { getServerCustomerEmails } from "@/lib/api/admin-emails.server"
import { EmailStatusBadges, formatEmailDate } from "./admin-email-presentation"

export async function AdminCustomerEmails({
  workspaceId,
}: {
  workspaceId: string
}) {
  let emails
  try {
    emails = await getServerCustomerEmails(workspaceId)
  } catch {
    return (
      <p className="p-5 text-xs text-muted-foreground">
        E-posta geçmişi şu anda alınamıyor. Diğer müşteri bilgilerini kullanmaya
        devam edebilirsiniz.
      </p>
    )
  }
  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Bu hesaba bağlı son 5 gönderim
        </p>
        <Link
          href={`${APP_ROUTES.admin.emails}?workspaceId=${encodeURIComponent(workspaceId)}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Tümünü görüntüle
        </Link>
      </div>
      {emails.length ? (
        <div className="divide-y divide-border">
          {emails.map((email) => (
            <Link
              key={email.id}
              href={APP_ROUTES.admin.email(email.id)}
              className="block px-5 py-4 hover:bg-muted/40"
            >
              <p className="truncate text-sm font-medium">{email.subject}</p>
              <p className="mt-1 text-xs break-all text-muted-foreground">
                {email.recipientEmail}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <EmailStatusBadges email={email} />
                <time className="text-[11px] text-muted-foreground">
                  {formatEmailDate(email.createdAt)}
                </time>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="p-5 text-xs text-muted-foreground">
          Bu müşteri hesabıyla ilişkilendirilmiş e-posta kaydı bulunmuyor.
        </p>
      )}
    </>
  )
}
