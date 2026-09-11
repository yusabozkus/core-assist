import { BillingOverview } from "./billing-overview"
import {
  getServerBillingHistory,
  getServerBillingSummary,
} from "@/lib/api/billing.server"
import { getBillingWorkspace } from "@/lib/billing-workspace.server"
import { BillingAccessNotice } from "@/components/dashboard/billing/billing-access-notice"
import { BillingShellHeader } from "@/components/dashboard/billing/billing-shell-header"

export default async function BillingPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const workspace = await getBillingWorkspace(workspaceId)
  if (!workspace) return <BillingAccessNotice />
  const [summary, history] = await Promise.all([
    getServerBillingSummary(workspace.id),
    getServerBillingHistory(workspace.id).catch(() => null),
  ])
  return (
    <>
      <BillingShellHeader />
      <BillingOverview
        workspaceId={workspace.id}
        summary={summary}
        history={history}
      />
    </>
  )
}
