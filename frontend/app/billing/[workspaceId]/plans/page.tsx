import { PlansClient } from "./plans-client"
import { getServerBillingSummary } from "@/lib/api/billing.server"
import { getBillingWorkspace } from "@/lib/billing-workspace.server"
import { BillingAccessNotice } from "@/components/dashboard/billing/billing-access-notice"

export default async function PlansPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const workspace = await getBillingWorkspace(workspaceId)
  if (!workspace) return <BillingAccessNotice />
  const billing = await getServerBillingSummary(workspace.id).catch(() => null)
  return (
    <PlansClient
      key={workspace.id}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialBillingSummary={billing}
    />
  )
}
