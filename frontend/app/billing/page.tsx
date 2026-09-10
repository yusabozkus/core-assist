import Link from "next/link"
import { redirect } from "next/navigation"
import { BillingWorkspaceHeader } from "@/components/dashboard/billing/billing-workspace-header"
import { BillingWorkspaceSetup } from "@/components/dashboard/billing/billing-workspace-setup"
import { APP_ROUTES } from "@/constants/site"
import { getCurrentUser } from "@/lib/server-auth"
import { getServerBillingWorkspaces } from "@/lib/api/billing.server"
import { billingRoutes } from "@/lib/billing-routes"

export default async function BillingEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; choose?: string }>
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
  if (workspaces.length === 1 && params.choose !== "1") {
    redirect(billingRoutes(workspaces[0].id)[view])
  }
  return (
    <>
      <BillingWorkspaceHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-20">
        <p className="text-xs font-medium text-primary">Plan ve faturalama</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {workspaces.length
            ? "Çalışma alanınızı seçin"
            : "Faturalandırma alanınızı hazırlayın"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Abonelik tüm çalışma alanını kapsar. Mağazanız olmasa veya kurulumunuz
          tamamlanmasa da ödemelerinizi, faturalarınızı ve iptal işlemlerinizi
          buradan yönetebilirsiniz.
        </p>
        {workspaces.length ? (
          <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  href={billingRoutes(workspace.id)[view]}
                  className="flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="min-w-0 truncate font-medium">
                    {workspace.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Yönet →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <BillingWorkspaceSetup view={view} />
        )}
      </main>
    </>
  )
}
