import { Badge } from "@/components/ui/badge"
import type { InvoiceStatus } from "@/types/billing"

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge
      variant={status === "paid" ? "success" : "warning"}
      className="gap-1.5 text-[10px] font-medium"
    >
      <span className="size-1 rounded-full bg-current" />
      {status === "paid" ? "Ödendi" : "İade edildi"}
    </Badge>
  )
}
