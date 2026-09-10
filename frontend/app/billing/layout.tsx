import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Plan ve faturalama | CoreAssist",
  robots: { index: false, follow: false },
}

// Authentication and workspace authorization are checked by each page,
// independently of dashboard/onboarding and operational store access.
export default function BillingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="min-h-svh bg-background">{children}</div>
}
