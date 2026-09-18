import type { Metadata } from "next"

import { AdminSystemHealthDashboard } from "@/components/admin/system/admin-system-health-dashboard"
import { getServerAdminSystemHealth } from "@/lib/api/admin-insights.server"

export const metadata: Metadata = {
  title: "Sistem Sağlığı | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

export default async function AdminSystemPage() {
  const data = await getServerAdminSystemHealth()
  return <AdminSystemHealthDashboard data={data} />
}
