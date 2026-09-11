import { apiFetch } from "@/lib/api/client"
import type {
  InvitationLinkResult,
  TeamAccessLevel,
  TeamOverview,
} from "@/types/team"

type TeamAccessInput = {
  accessLevel: TeamAccessLevel
  storeIds?: string[]
}

export function getTeam(workspaceId: string, signal?: AbortSignal) {
  return apiFetch<TeamOverview>(
    `/workspaces/${encodeURIComponent(workspaceId)}/team`,
    { signal }
  )
}

export function createTeamInvitation(
  workspaceId: string,
  input: TeamAccessInput & { email: string }
) {
  return apiFetch<InvitationLinkResult>(
    `/workspaces/${encodeURIComponent(workspaceId)}/team/invitations`,
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function renewTeamInvitationLink(
  workspaceId: string,
  invitationId: string
) {
  return apiFetch<InvitationLinkResult>(
    `/workspaces/${encodeURIComponent(workspaceId)}/team/invitations/${encodeURIComponent(invitationId)}/link`,
    { method: "POST" }
  )
}

export function revokeTeamInvitation(
  workspaceId: string,
  invitationId: string
) {
  return apiFetch<{ revoked: true; invitationId: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/team/invitations/${encodeURIComponent(invitationId)}`,
    { method: "DELETE" }
  )
}

export function updateTeamMember(
  workspaceId: string,
  userId: string,
  input: TeamAccessInput
) {
  return apiFetch<{ updated: true; userId: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/team/members/${encodeURIComponent(userId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  )
}

export function removeTeamMember(workspaceId: string, userId: string) {
  return apiFetch<{ removed: true; userId: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/team/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  )
}

export function acceptWorkspaceInvitation(token: string) {
  return apiFetch<{
    accepted: true
    workspace: { id: string; name: string }
    nextPath: string
  }>(`/workspace-invitations/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  })
}
