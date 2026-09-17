import { getProviderName } from "@/components/dashboard/catalog/products/product-catalog-utils"
import type { AdminOperation } from "@/types/admin-operations"
import type {
  SyncHistoryKind,
  SyncHistoryStage,
  SyncHistoryStatus,
  SyncHistoryTrigger,
} from "@/types/sync-history"

export const ADMIN_OPERATION_STATUS: Record<
  SyncHistoryStatus,
  { label: string; className: string }
> = {
  RUNNING: {
    label: "Çalışıyor",
    className:
      "border-sky-500/25 bg-sky-500/8 text-sky-700 dark:text-sky-300",
  },
  COMPLETED: {
    label: "Tamamlandı",
    className:
      "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
  },
  FAILED: {
    label: "Başarısız",
    className: "border-destructive/25 bg-destructive/8 text-destructive",
  },
}

export const ADMIN_OPERATION_KINDS: Array<{
  value: SyncHistoryKind
  label: string
}> = [
  { value: "FULL", label: "Ürün kataloğu" },
  { value: "INVENTORY", label: "Stok kontrolü" },
  { value: "QUESTION", label: "Soru kontrolü" },
]

export function adminOperationKindLabel(kind: SyncHistoryKind) {
  return ADMIN_OPERATION_KINDS.find((item) => item.value === kind)?.label ?? kind
}

export function adminOperationTriggerLabel(trigger: SyncHistoryTrigger) {
  if (trigger === "SCHEDULED") return "Otomatik"
  if (trigger === "RETRY") return "Yeniden deneme"
  if (trigger === "ONBOARDING") return "Onboarding"
  return "Manuel"
}

export function adminOperationStageLabel(stage: SyncHistoryStage) {
  if (stage === "QUEUED") return "Kuyrukta"
  if (stage === "FETCHING") return "Pazaryerinden alınıyor"
  if (stage === "PERSISTING") return "Veriler işleniyor"
  if (stage === "RECONCILING") return "Katalog uzlaştırılıyor"
  if (stage === "FAILED") return "Başarısız"
  return "Tamamlandı"
}

export function adminOperationProviderLabel(providerKey: string) {
  return getProviderName(providerKey)
}

export function formatAdminOperationDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value))
}

export function formatAdminOperationDuration(milliseconds: number) {
  if (milliseconds < 1_000) return "1 sn'den kısa"
  const seconds = Math.floor(milliseconds / 1_000)
  if (seconds < 60) return `${seconds} sn`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} dk ${seconds % 60} sn`
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`
}

export function formatAdminOperationNumber(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value)
}

export function adminOperationPrimaryMetric(run: AdminOperation) {
  if (run.kind === "QUESTION") {
    return {
      label: "Yeni soru",
      value: run.metrics.questionsProcessed,
      helper: `${formatAdminOperationNumber(run.metrics.questionsUnchanged)} değişmeyen`,
    }
  }
  if (run.kind === "INVENTORY") {
    return {
      label: "Varyant",
      value: run.metrics.variantsProcessed,
      helper: `${formatAdminOperationNumber(run.metrics.variantsUpdated)} güncellendi`,
    }
  }
  return {
    label: "Ürün",
    value: run.metrics.productsProcessed,
    helper: `${formatAdminOperationNumber(run.metrics.productsUpdated)} güncellendi`,
  }
}
