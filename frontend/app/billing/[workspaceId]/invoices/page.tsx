import { InvoicesClient } from "./invoices-client"
import { getServerBillingHistory } from "@/lib/api/billing.server"
import { getBillingWorkspace } from "@/lib/billing-workspace.server"
import { BillingAccessNotice } from "@/components/dashboard/billing/billing-access-notice"
import { BillingShellHeader } from "@/components/dashboard/billing/billing-shell-header"

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const workspace = await getBillingWorkspace(workspaceId)
  if (!workspace) return <BillingAccessNotice />
  const history = await getServerBillingHistory(workspace.id).catch(() => null)
  return (
    <>
      <BillingShellHeader />
      <InvoicesClient
        key={workspace.id}
        workspaceId={workspace.id}
        history={history}
      />
    </>
  )
}
