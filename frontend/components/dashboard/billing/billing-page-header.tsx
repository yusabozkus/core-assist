import Link from "next/link"
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import { cn } from "@/lib/utils"

const links = [
  {
    id: "overview",
    label: "Abonelik ve kullanım",
    href: APP_ROUTES.dashboard.settings.billing,
  },
  {
    id: "invoices",
    label: "Faturalar",
    href: APP_ROUTES.dashboard.settings.invoices,
  },
] as const

export function BillingPageHeader({
  active,
}: {
  active: "overview" | "invoices"
}) {
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
          <Link href={APP_ROUTES.dashboard.settings.plans}>
            Planları karşılaştır{" "}
            <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
          </Link>
        </Button>
      </div>
      <nav
        aria-label="Faturalama sayfaları"
        className="mt-7 flex items-center gap-6 border-b border-border"
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
        <span className="ml-auto hidden text-xs text-muted-foreground sm:block">
          Örnek görünüm
        </span>
      </nav>
    </header>
  )
}
