import type { TeamAccessLevel } from "@/types/team"

export const TEAM_ACCESS_OPTIONS: ReadonlyArray<{
  value: TeamAccessLevel
  label: string
  description: string
}> = [
  {
    value: "ACCOUNT_ADMIN",
    label: "Hesap yöneticisi",
    description: "Tüm mağazaları, ekibi ve faturalandırmayı yönetebilir.",
  },
  {
    value: "STORE_ADMIN",
    label: "Mağaza yöneticisi",
    description:
      "Seçilen mağazaların ayarlarını ve operasyonlarını yönetebilir.",
  },
  {
    value: "AGENT",
    label: "Temsilci",
    description:
      "Soruları inceleyebilir, taslak hazırlayabilir ve yanıtlayabilir.",
  },
  {
    value: "VIEWER",
    label: "Görüntüleyici",
    description: "Seçilen mağazalardaki verileri yalnızca görüntüleyebilir.",
  },
]

export function getTeamAccessLabel(accessLevel: "OWNER" | TeamAccessLevel) {
  if (accessLevel === "OWNER") return "Hesap sahibi"
  return (
    TEAM_ACCESS_OPTIONS.find((option) => option.value === accessLevel)?.label ??
    accessLevel
  )
}
