import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminQueueDetailView } from "@/components/admin/operations/admin-queue-detail"
import { getServerAdminOperationQueue } from "@/lib/api/admin-operations.server"

export const metadata: Metadata = {
  title: "Kuyruk Detayı | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

const QUEUE_KEYS = new Set([
  "product-sync",
  "question-sync",
  "question-draft",
  "question-answer",
  "size-guide",
  "paddle-webhooks",
  "billing-recovery",
  "support-notifications",
  "data-retention",
])

export default async function AdminOperationQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ queueKey: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { queueKey } = await params
  if (!QUEUE_KEYS.has(queueKey)) notFound()

  const pageValue = first((await searchParams).page)
  const parsedPage = Number(pageValue ?? "1")
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const queue = await getServerAdminOperationQueue(queueKey, page)

  if (page > queue.pagination.totalPages) notFound()
  return <AdminQueueDetailView queue={queue} />
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
