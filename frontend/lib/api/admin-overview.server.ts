import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"

import type { AdminOverview } from "@/types/admin-overview"

export async function getServerAdminOverview() {
  const cookie = (await headers()).get("cookie")
  if (!cookie) {
    throw new Error("Admin overview requires an authenticated session.")
  }

  const response = await fetchServerApi(`/admin/overview`, { cookie })

  if (!response.ok) {
    throw new Error(`Admin overview request failed with ${response.status}.`)
  }

  return response.json() as Promise<AdminOverview>
}
