import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminAiBlockerListView } from "@/components/admin/ai-usage/admin-ai-blocker-list"
import { getServerAdminAiBlockers } from "@/lib/api/admin-insights.server"
import type { AdminAiBlockerType } from "@/types/admin-ai-usage"

export const metadata: Metadata = {
  title: "AI İşlem Engelleri | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const BLOCKER_TYPES = new Set<AdminAiBlockerType>([
  "generation-failures",
  "delivery-failures",
  "quota",
  "subscription",
  "missing-information",
  "knowledge-conflicts",
])

export default async function AdminAiBlockerPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { type: rawType } = await params
  if (!BLOCKER_TYPES.has(rawType as AdminAiBlockerType)) notFound()

  const type = rawType as AdminAiBlockerType
  const rawPage = first((await searchParams).page)
  const page = positiveInteger(rawPage, 1)
  const data = await getServerAdminAiBlockers(type, page)

  if (page > data.pagination.totalPages) notFound()
  return <AdminAiBlockerListView data={data} />
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}
