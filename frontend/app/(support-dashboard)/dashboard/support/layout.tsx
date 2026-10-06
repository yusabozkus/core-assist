import { DashboardShell } from "@/components/shared/dashboard/dashboard-shell"

export const dynamic = "force-dynamic"

export default function SupportLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Account-level support remains available without a selected store.
  return <DashboardShell requireActiveStore={false}>{children}</DashboardShell>
}
