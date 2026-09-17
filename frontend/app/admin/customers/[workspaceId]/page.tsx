import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AdminCustomerDetailView } from "@/components/admin/customers/admin-customer-detail"
import {
  AdminCustomerNotFoundError,
  getServerAdminCustomer,
} from "@/lib/api/admin-customers.server"

export const metadata: Metadata = {
  title: "Müşteri Detayı | Core Asistan Admin",
}

export const dynamic = "force-dynamic"

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) notFound()

  let customer
  try {
    customer = await getServerAdminCustomer(workspaceId)
  } catch (error) {
    if (error instanceof AdminCustomerNotFoundError) notFound()
    throw error
  }

  return <AdminCustomerDetailView customer={customer} />
}
