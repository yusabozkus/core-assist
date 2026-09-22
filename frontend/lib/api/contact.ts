import { apiFetch } from "@/lib/api/client"
import type { CreateContactMessageInput } from "@/types/contact"

export function createContactMessage(input: CreateContactMessageInput) {
  return apiFetch<{ accepted: true }>("/contact", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
