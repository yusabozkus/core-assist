import { AppLogo } from "@/components/shared/brand/app-logo"
import { APP_ROUTES } from "@/constants/site"

export default function CheckoutPageLoading() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_5%,color-mix(in_oklab,var(--primary)_7%,transparent),transparent_28%),linear-gradient(to_bottom,color-mix(in_oklab,var(--muted)_22%,transparent),transparent_52%)]"
      />
      <header className="relative bg-background/65 backdrop-blur-xl">
        <div className="mx-auto flex h-17 w-full max-w-[1180px] items-center border-b border-border/60 px-5 sm:px-8">
          <AppLogo href={APP_ROUTES.dashboard.settings.plans} />
        </div>
      </header>
      <div className="relative mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-8 sm:px-8 sm:py-11 lg:grid-cols-[minmax(0,0.82fr)_minmax(500px,1.18fr)] lg:gap-18 lg:py-14">
        <div className="animate-pulse space-y-5">
          <div className="h-3 w-24 rounded-full bg-primary/15" />
          <div className="h-10 w-52 rounded-lg bg-muted" />
          <div className="h-5 w-full max-w-sm rounded bg-muted" />
          <div className="mt-8 h-64 rounded-2xl bg-card/75 ring-1 ring-border/60" />
          <div className="h-24 rounded-xl bg-muted/25" />
        </div>
        <div className="min-h-[730px] animate-pulse overflow-hidden rounded-[1.4rem] bg-card/90 p-7 shadow-[0_30px_90px_-52px_color-mix(in_oklab,var(--foreground)_38%,transparent)] ring-1 ring-border/65">
          <div className="h-6 w-44 rounded bg-muted/70" />
          <div className="mt-12 space-y-5 border-t border-border/55 pt-8">
            <div className="h-11 rounded-xl bg-muted/70" />
            <div className="h-11 rounded-xl bg-muted/70" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-11 rounded-xl bg-muted/70" />
              <div className="h-11 rounded-xl bg-muted/70" />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
