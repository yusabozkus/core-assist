import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminBillingDetailView } from "@/components/admin/billing/admin-billing-detail"
import {
  AdminBillingNotFoundError,
  getServerAdminBillingDetail,
} from "@/lib/api/admin-billing.server"

export const metadata: Metadata = {
  title: "Abonelik Detayı | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

export default async function AdminBillingDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) notFound()

  let billing
  try {
    billing = await getServerAdminBillingDetail(workspaceId)
  } catch (error) {
    if (error instanceof AdminBillingNotFoundError) notFound()
    throw error
  }

  return <AdminBillingDetailView initialBilling={billing} />
}
