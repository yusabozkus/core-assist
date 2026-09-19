import Link from "next/link"
import { AppLogo } from "@/components/shared/brand/app-logo"
import { Button } from "@/components/ui/button"
import { APP_ROUTES } from "@/constants/site"
import Image from "next/image"

export function BillingShellHeader() {
  return (
    <header className="border-b border-border/70">
      <div className="mx-auto flex min-h-18 w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8 lg:px-10">
        <AppLogo
          href={APP_ROUTES.dashboard.root}
          description="Commerce Operations"
          showIcon={true}
        />
        <Button asChild variant="ghost" size="sm">
          <Link href={APP_ROUTES.dashboard.root}>Panele dön</Link>
        </Button>
      </div>
    </header>
  )
}
