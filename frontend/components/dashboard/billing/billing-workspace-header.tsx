import Link from "next/link"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import type { BillingWorkspace } from "@/types/billing"

export function BillingWorkspaceHeader({
  workspace,
}: {
  workspace?: BillingWorkspace
}) {
  return (
    <header className="border-b border-border/70">
      <div className="mx-auto flex min-h-18 w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <AppLogo href={APP_ROUTES.dashboard.settings.billing} />
          {workspace && (
            <div className="min-w-0 border-l border-border pl-4">
              <p className="text-[10px] text-muted-foreground">Çalışma alanı</p>
              <Link
                href="/billing?choose=1"
                className="block max-w-44 truncate text-sm font-medium hover:text-primary"
                title="Çalışma alanını değiştir"
              >
                {workspace.name}
              </Link>
            </div>
          )}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={APP_ROUTES.dashboard.root}>Panele dön</Link>
        </Button>
      </div>
    </header>
  )
}
