export type ActivityCategory =
  "ALL" | "ANSWERS" | "SETTINGS" | "CATALOG" | "CHANNELS" | "TEAM" | "BILLING"

export type ActivityPeriod = "ALL" | "DAY" | "WEEK" | "MONTH"
export type ActivityResultFilter = "ALL" | "SUCCESS" | "FAILURE"
export type ActivityActorFilter = "ALL" | "SYSTEM" | "TEAM"
export type ActivityPageSize = 50 | 100 | 200

export type ActivityItem = {
  id: string
  createdAt: string
  category: Exclude<ActivityCategory, "ALL">
  title: string
  summary: string
  result: "SUCCESS" | "FAILURE"
  actorType: "USER" | "ADMIN" | "SYSTEM"
  actorName: string
  actorEmail: string | null
  actorAvatarUrl: string | null
  href: string
}

export type ActivityPage = {
  items: ActivityItem[]
  nextCursor: string | null
  canViewAccountEvents: boolean
}
