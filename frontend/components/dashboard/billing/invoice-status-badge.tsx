import { Badge } from "@/components/ui/badge"
import type { InvoiceStatus } from "@/types/billing"

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const label =
    status === "paid"
      ? "Ödendi"
      : status === "partially_refunded"
        ? "Kısmen iade"
        : "İade edildi"

  return (
    <Badge
      variant={status === "paid" ? "success" : "warning"}
      className="gap-1.5 text-[10px] font-medium"
    >
      <span className="size-1 rounded-full bg-current" />
      {label}
    </Badge>
  )
}
