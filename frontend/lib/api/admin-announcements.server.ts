import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"
import { headers } from "next/headers"
import type { AnnouncementList } from "@/types/admin-announcement"

export async function getServerAdminAnnouncements(query: {
  q?: string
  page: number
}): Promise<AnnouncementList> {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Admin announcements require authentication.")
  const params = new URLSearchParams({ page: String(query.page) })
  if (query.q) params.set("q", query.q)
  const response = await fetchServerApi(`/admin/announcements?${params}`, {
    cookie,
  })
  if (!response.ok)
    throw new Error(
      `Admin announcements request failed with ${response.status}.`
    )
  return response.json() as Promise<AnnouncementList>
}
