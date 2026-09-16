import { redirect } from "next/navigation"

import { APP_ROUTES } from "@/constants/site"
import { getAdminAccess } from "@/lib/admin-access.server"

export const dynamic = "force-dynamic"

export default async function AuthContinuePage() {
  const access = await getAdminAccess()

  if (access.status === "unauthenticated") {
    redirect(APP_ROUTES.login)
  }

  if (access.status === "authorized") {
    redirect(APP_ROUTES.admin.root)
  }

  redirect(APP_ROUTES.dashboard.root)
}
