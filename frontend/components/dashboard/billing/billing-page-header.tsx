import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { billingRoutes } from "@/lib/billing-routes"
import { cn } from "@/lib/utils"

export function BillingPageHeader({
  active,
  workspaceId,
  children,
}: {
  workspaceId: string
  active: "overview" | "invoices"
  children?: ReactNode
}) {
  const links = [
    {
      id: "overview",
      label: "Abonelik ve kullanım",
      href: billingRoutes(workspaceId).overview,
    },
    {
      id: "invoices",
      label: "Faturalar",
      href: billingRoutes(workspaceId).invoices,
    },
  ] as const
  return (
    <header>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {active === "overview" ? "Plan ve faturalama" : "Faturalar"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {active === "overview"
              ? "Aboneliğiniz, kullanımınız ve ödeme bilgileriniz."
              : "Ödemelerinizi ve geçmiş fatura dönemlerinizi takip edin."}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="bg-card">
          <Link href={billingRoutes(workspaceId).plans}>
            Planları karşılaştır{" "}
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
          </Link>
        </Button>
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
      <nav
        aria-label="Faturalama sayfaları"
        className="mt-6 flex items-center gap-6 border-b border-border"
      >
        {links.map((link) => (
          <Link
            key={link.id}
            href={link.href}
            aria-current={active === link.id ? "page" : undefined}
            className={cn(
              "relative -mb-px border-b-2 py-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === link.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
