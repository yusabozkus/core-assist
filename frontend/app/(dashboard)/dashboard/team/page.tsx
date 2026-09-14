import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { TeamManagement } from "@/components/dashboard/team/team-management"
import { APP_ROUTES } from "@/constants/site"
import { getServerBillingWorkspaces } from "@/lib/api/billing.server"
import { getServerTeam } from "@/lib/api/team.server"
import { getCurrentUser } from "@/lib/server-auth"

export const metadata: Metadata = {
  title: "Ekip ve Yetkiler | Core Asistan",
  description: "Core Asistan ekip üyelerini ve mağaza erişimlerini yönetin.",
}

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const [currentUser, workspaces] = await Promise.all([
    getCurrentUser(),
    getServerBillingWorkspaces(),
  ])
  if (!currentUser) redirect(APP_ROUTES.login)
  const workspace = workspaces[0]
  if (!workspace) redirect(APP_ROUTES.dashboard.root)
  const team = await getServerTeam(workspace.id)

  return (
    <TeamManagement
      workspaceId={workspace.id}
      currentUserId={currentUser.user.id}
      initialTeam={team}
    />
  )
}
