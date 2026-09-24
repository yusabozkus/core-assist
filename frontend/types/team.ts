export type TeamAccessLevel =
  "ACCOUNT_ADMIN" | "STORE_ADMIN" | "AGENT" | "VIEWER"

export type TeamInvitationEmailStatus =
  "SENT" | "PENDING" | "FAILED" | "NOT_SENT"

export type TeamStore = {
  id: string
  name: string
  status?: "ACTIVE" | "INACTIVE"
}

export type TeamMember = {
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER"
  accessLevel: "OWNER" | TeamAccessLevel
  stores: TeamStore[]
  joinedAt: string
  isOwner: boolean
}

export type TeamInvitation = {
  id: string
  email: string
  accessLevel: TeamAccessLevel
  stores: TeamStore[]
  invitedBy: { id: string; name: string } | null
  expiresAt: string
  createdAt: string
  emailDelivery: TeamInvitationEmailStatus
}

export type TeamOverview = {
  workspace: { id: string; name: string }
  canInviteAccountAdmins: boolean
  capacity: {
    used: number
    limit: number
    remaining: number
    percentage: number
  }
  stores: TeamStore[]
  members: TeamMember[]
  invitations: TeamInvitation[]
}

export type InvitationLinkResult = {
  invitation: TeamInvitation
  acceptPath: string
  emailDelivery: TeamInvitationEmailStatus
}

export type WorkspaceInvitationPreview = {
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
  workspaceName: string
  invitedByName: string | null
  email: string
  accessLevel: TeamAccessLevel
  stores: Array<{ id: string; name: string }>
  expiresAt: string
}
