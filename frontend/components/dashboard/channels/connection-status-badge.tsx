import { Badge } from "@/components/ui/badge"
import type { ChannelConnectionStatus } from "@/types/channel"

type ConnectionStatusBadgeProps = {
  status: ChannelConnectionStatus
  isSyncing: boolean
}

export function ConnectionStatusBadge({
  status,
  isSyncing,
}: ConnectionStatusBadgeProps) {
  if (isSyncing) return <Badge variant="warning">Senkronize ediliyor</Badge>
  if (status === "CONNECTED") return <Badge variant="success">Bağlı</Badge>
  if (status === "PENDING")
    return <Badge variant="warning">Kurulum bekliyor</Badge>
  if (status === "ERROR")
    return (
      <Badge
        variant="outline"
        className="border-destructive/25 text-destructive"
      >
        Bağlantı hatası
      </Badge>
    )
  return <Badge variant="secondary">Devre dışı</Badge>
}
