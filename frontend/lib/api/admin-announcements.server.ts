import "server-only"
import { headers } from "next/headers"
import type { AnnouncementList } from "@/types/admin-announcement"

export async function getServerAdminAnnouncements(): Promise<AnnouncementList> {
  const apiUrl = (
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4001"
  ).replace(/\/$/, "")
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Admin announcements require authentication.")
  const response = await fetch(`${apiUrl}/admin/announcements`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok)
    throw new Error(
      `Admin announcements request failed with ${response.status}.`
    )
  return response.json() as Promise<AnnouncementList>
}
