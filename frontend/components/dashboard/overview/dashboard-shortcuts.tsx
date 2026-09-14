import Link from "next/link"
import {
  ArrowRight01Icon,
  Analytics01Icon,
  Settings02Icon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { APP_ROUTES } from "@/constants/site"

const shortcuts = [
  {
    icon: Settings02Icon,
    title: "Yanıt ayarları",
    description: "Yanıt tonunu ve otomasyonu yönetin",
    href: APP_ROUTES.dashboard.automations.root,
  },
  {
    icon: WorkflowSquare01Icon,
    title: "Mağaza bilgi merkezi",
    description: "AI için kuralları ve mağaza bilgilerini tamamlayın",
    href: APP_ROUTES.dashboard.automations.knowledge,
  },
  {
    icon: Analytics01Icon,
    title: "AI performansı",
    description: "Taslak kalitesini ve otomasyon sonuçlarını inceleyin",
    href: APP_ROUTES.dashboard.analytics,
  },
]

export function DashboardShortcuts() {
  return (
    <nav
      aria-label="Hızlı erişim"
      className="grid gap-3 md:grid-cols-3"
    >
      {shortcuts.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors outline-none hover:border-primary/25 hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HugeiconsIcon
            icon={link.icon}
            className="size-5 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold">{link.title}</span>
            <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
              {link.description}
            </span>
          </span>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      ))}
    </nav>
  )
}
