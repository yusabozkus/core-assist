import type { Metadata } from "next"

import { AdminOverviewDashboard } from "@/components/admin/overview/admin-overview-dashboard"
import { getServerAdminOverview } from "@/lib/api/admin-overview.server"

export const metadata: Metadata = {
  title: "Genel Bakış | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

export default async function AdminOverviewPage() {
  const data = await getServerAdminOverview()
  return <AdminOverviewDashboard data={data} />
}
