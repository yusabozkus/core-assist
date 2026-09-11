import "server-only"

import { headers } from "next/headers"
import type { TeamOverview, WorkspaceInvitationPreview } from "@/types/team"

const apiUrl = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "")

export async function getServerTeam(workspaceId: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Team management requires authentication.")

  const response = await fetch(
    `${apiUrl}/workspaces/${encodeURIComponent(workspaceId)}/team`,
    {
      cache: "no-store",
      headers: { Accept: "application/json", cookie },
      signal: AbortSignal.timeout(10_000),
    }
  )
  if (!response.ok) {
    throw new Error(`Team request failed with status ${response.status}.`)
  }
  return response.json() as Promise<TeamOverview>
}

export async function getServerWorkspaceInvitation(token: string) {
  const response = await fetch(
    `${apiUrl}/workspace-invitations/${encodeURIComponent(token)}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    }
  )
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Invitation request failed with status ${response.status}.`)
  }
  return response.json() as Promise<WorkspaceInvitationPreview>
}
