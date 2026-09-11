import { redirect } from "next/navigation"
import { BillingShellHeader } from "@/components/dashboard/billing/billing-shell-header"
import { BillingSetup } from "@/components/dashboard/billing/billing-setup"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"
import { getServerBillingWorkspaces } from "@/lib/api/billing.server"
import { billingRoutes } from "@/lib/billing-routes"

export default async function BillingEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const view =
    params.view === "plans" || params.view === "invoices"
      ? params.view
      : "overview"
  const session = await getCurrentUser()
  if (!session) {
    const returnTo = view === "overview" ? "/billing" : `/billing?view=${view}`
    redirect(`${APP_ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`)
  }
  const workspaces = await getServerBillingWorkspaces()
  if (workspaces.length > 0) {
    redirect(billingRoutes(workspaces[0].id)[view])
  }
  return (
    <>
      <BillingShellHeader />
      <main className="mx-auto w-full max-w-2xl space-y-6 px-5 py-12 sm:py-20">
        <h1 className="text-2xl font-semibold tracking-tight">Plan ve faturalama</h1>
        <BillingSetup view={view} />
      </main>
    </>
  )
}
