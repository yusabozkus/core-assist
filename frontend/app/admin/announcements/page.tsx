import type { Metadata } from "next"
import { AdminAnnouncements } from "@/components/admin/announcements/admin-announcements"
import { getServerAdminAnnouncements } from "@/lib/api/admin-announcements.server"

export const metadata: Metadata = { title: "Duyurular | Core Asistan Admin" }
export const dynamic = "force-dynamic"

export default async function AdminAnnouncementsPage() {
  const data = await getServerAdminAnnouncements()
  return <AdminAnnouncements data={data} />
}
