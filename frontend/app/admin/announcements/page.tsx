import type { Metadata } from "next"
import { AdminAnnouncements } from "@/components/admin/announcements/admin-announcements"
import { getServerAdminAnnouncements } from "@/lib/api/admin-announcements.server"

export const metadata: Metadata = { title: "Duyurular | Core Asistan Admin" }
export const dynamic = "force-dynamic"

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value
  const q = first(params.q)?.trim().slice(0, 120) || undefined
  const requestedPage = Number(first(params.page) ?? 1)
  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0 &&
    requestedPage <= 100000
      ? requestedPage
      : 1
  const data = await getServerAdminAnnouncements({ q, page })
  return <AdminAnnouncements key={q ?? ""} data={data} query={{ q, page }} />
}
