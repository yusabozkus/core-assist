import type { ContactMessageStatus, ContactMessageTopic } from "@/types/contact"

export const CONTACT_STATUS: Record<
  ContactMessageStatus,
  { label: string; className: string }
> = {
  NEW: {
    label: "Yeni",
    className:
      "border-blue-500/25 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-300",
  },
  READ: {
    label: "Okundu",
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  ARCHIVED: {
    label: "Arşivlendi",
    className:
      "border-slate-400/35 bg-slate-500/10 text-slate-600 hover:bg-slate-500/15 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-300",
  },
}

export const CONTACT_TOPIC: Record<ContactMessageTopic, string> = {
  PRODUCT: "Ürün hakkında",
  PRICING: "Planlar ve fiyatlandırma",
  PARTNERSHIP: "İş ortaklığı",
  OTHER: "Diğer",
}

export function formatContactDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
