import { apiFetch } from "@/lib/api/client"
import type {
  AccountDataExport,
  AccountDeletionStatus,
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

export function getAccountDeletionStatus() {
  return apiFetch<AccountDeletionStatus>("/users/me/deletion-status", {
    cache: "no-store",
  })
}

export function closeAccountBilling(confirmation: string) {
  return apiFetch<AccountDeletionStatus>("/users/me/close-billing", {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  })
}

export function deleteCurrentUser(confirmation: string) {
  return apiFetch<{ success: boolean }>("/users/me/delete", {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  })
}
