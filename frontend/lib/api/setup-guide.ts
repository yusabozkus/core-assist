import { apiFetch } from "@/lib/api/client"

export type SetupGuideState = {
  phase: "essential" | "optional" | "done"
  aiSettingsVisited: boolean
  channelsVisited: boolean
  teamVisited: boolean
  skippedFaq: boolean
}

export type SetupGuideUpdate =
  | {
      action:
        | "VISIT_AI"
        | "VISIT_CHANNELS"
        | "VISIT_TEAM"
        | "CONTINUE_OPTIONAL"
        | "SKIP_FAQ"
        | "FINISH"
    }
  | ({ action: "IMPORT_LEGACY" } & Pick<
      SetupGuideState,
      "phase" | "aiSettingsVisited" | "skippedFaq"
    >)

export function getSetupGuideState(storeId: string, signal?: AbortSignal) {
  return apiFetch<SetupGuideState>(`/stores/${storeId}/setup-guide`, {
    cache: "no-store",
    signal,
  })
}

export function updateSetupGuideState(
  storeId: string,
  update: SetupGuideUpdate,
  signal?: AbortSignal
) {
  return apiFetch<SetupGuideState>(`/stores/${storeId}/setup-guide`, {
    method: "PATCH",
    body: JSON.stringify(update),
    signal,
  })
}
