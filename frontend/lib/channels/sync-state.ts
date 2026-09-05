import type { ChannelConnection } from "@/types/channel"

export type DashboardSyncState =
  "current" | "error" | "idle" | "pending" | "syncing" | "unavailable"

export function getDashboardSyncState(
  connections: ChannelConnection[] | null
): DashboardSyncState {
  if (!connections) return "unavailable"
  if (connections.length === 0) return "idle"

  if (
    connections.some(
      (connection) =>
        connection.processingStartedAt || connection.questionSyncStartedAt
    )
  ) {
    return "syncing"
  }

  if (
    connections.some(
      (connection) =>
        connection.status === "ERROR" ||
        connection.failureReason ||
        connection.questionSyncFailureReason
    )
  ) {
    return "error"
  }

  const connectedConnections = connections.filter(
    (connection) => connection.status === "CONNECTED"
  )

  if (connectedConnections.length === 0) return "idle"

  if (
    connectedConnections.some(
      (connection) =>
        connection.lastInventorySyncAt !== null ||
        connection.lastSyncAt !== null ||
        connection.lastQuestionSyncAt !== null
    )
  ) {
    return "current"
  }

  return "pending"
}
