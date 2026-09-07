import { apiFetch } from "@/lib/api/client"
import type {
  AccountDataExport,
  UpdateProfilePayload,
  UserProfile,
} from "@/types/user"

export function updateCurrentUser(payload: UpdateProfilePayload) {
  return apiFetch<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function exportCurrentUserData() {
  return apiFetch<AccountDataExport>("/users/me/export")
}
