import "server-only"
import { fetchServerApi } from "@/lib/api/server-fetch"

import { headers } from "next/headers"
import type { TeamOverview, WorkspaceInvitationPreview } from "@/types/team"

export async function getServerTeam(workspaceId: string) {
  const cookie = (await headers()).get("cookie")
  if (!cookie) throw new Error("Team management requires authentication.")

  const response = await fetchServerApi(
    `/workspaces/${encodeURIComponent(workspaceId)}/team`,
    { cookie }
  )
  if (!response.ok) {
    throw new Error(`Team request failed with status ${response.status}.`)
  }
  return response.json() as Promise<TeamOverview>
}

export async function getServerWorkspaceInvitation(token: string) {
  const response = await fetchServerApi(
    `/workspace-invitations/${encodeURIComponent(token)}`,
    { cookie: null }
  )
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Invitation request failed with status ${response.status}.`)
  }
  return response.json() as Promise<WorkspaceInvitationPreview>
}
