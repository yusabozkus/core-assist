import type { Metadata } from "next"

import { AdminAiUsageDashboard } from "@/components/admin/ai-usage/admin-ai-usage-dashboard"
import { getServerAdminAiUsage } from "@/lib/api/admin-insights.server"
import type { AdminAiUsagePeriod } from "@/types/admin-ai-usage"

export const metadata: Metadata = {
  title: "AI ve Kullanım | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const PERIODS = new Set<AdminAiUsagePeriod>(["7D", "30D", "90D"])

export default async function AdminAiUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const rawPeriod = first((await searchParams).period) as
    AdminAiUsagePeriod | undefined
  const period = rawPeriod && PERIODS.has(rawPeriod) ? rawPeriod : "30D"
  const data = await getServerAdminAiUsage(period)
  return <AdminAiUsageDashboard data={data} />
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
