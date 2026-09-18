import "server-only"

import { headers } from "next/headers"

import type { AdminOverview } from "@/types/admin-overview"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export async function getServerAdminOverview() {
  const cookie = (await headers()).get("cookie")
  if (!cookie) {
    throw new Error("Admin overview requires an authenticated session.")
  }

  const response = await fetch(`${apiUrl}/admin/overview`, {
    cache: "no-store",
    headers: { Accept: "application/json", cookie },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    throw new Error(`Admin overview request failed with ${response.status}.`)
  }

  return response.json() as Promise<AdminOverview>
}
