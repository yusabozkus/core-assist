import { apiFetch } from "@/lib/api/client"
import type { UpdateProfilePayload, UserProfile } from "@/types/user"

export function updateCurrentUser(payload: UpdateProfilePayload) {
  return apiFetch<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}
