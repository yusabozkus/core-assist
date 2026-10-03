import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Plan ve faturalama | Core Asistan",
  robots: { index: false, follow: false },
}

// Each billing page checks authentication and completed onboarding before
// workspace authorization. Billing does not require an active store.
export default function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-svh bg-background">{children}</div>
}
