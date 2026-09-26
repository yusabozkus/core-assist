import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AdminEmailDetail } from "@/components/admin/emails/admin-email-detail"
import {
  AdminEmailNotFoundError,
  getServerAdminEmail,
} from "@/lib/api/admin-emails.server"

export const metadata: Metadata = {
  title: "E-posta Detayı | Core Asistan Admin",
}
export const dynamic = "force-dynamic"

export default async function AdminEmailPage({
  params,
}: {
  params: Promise<{ emailId: string }>
}) {
  const { emailId } = await params
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      emailId
    )
  )
    notFound()
  const email = await getServerAdminEmail(emailId).catch((error: unknown) => {
    if (error instanceof AdminEmailNotFoundError) notFound()
    throw error
  })
  return <AdminEmailDetail email={email} />
}
