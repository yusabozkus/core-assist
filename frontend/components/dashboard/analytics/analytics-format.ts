import type { ProductAnswerFact } from "@/types/question"
import type { AiPerformance } from "@/types/ai-performance"

export const formatCount = (value: number) => value.toLocaleString("tr-TR")
export const formatPercent = (value: number) =>
  `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
export const boundedPercent = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0

export const intentLabels: Record<ProductAnswerFact, string> = {
  STOCK: "Stok",
  PRICE: "Fiyat",
  MATERIAL: "Materyal",
  DURABILITY: "Dayanıklılık",
  SHIPPING: "Kargo",
  RETURN: "İade",
  EXCHANGE: "Değişim",
  WARRANTY: "Garanti",
  SIZE: "Beden",
  COLOR: "Renk",
  FIT: "Kalıp",
  CARE: "Bakım",
  PRODUCT_CODE: "Ürün kodu",
  PRODUCT_INFO: "Ürün bilgisi",
}

export const automationLabels = {
  OFF: "Manuel yanıt",
  SHADOW: "Otomatik taslak",
  SAFE_AUTO: "Otomatik gönderim",
}

export const reviewReasonLabels: Record<string, string> = {
  MISSING_INFORMATION: "Ürün veya mağaza bilgisi eksik",
  MISSING_EVIDENCE: "Yanıtı destekleyen kanıt eksik",
  PARTIAL_ANSWER: "Sorunun tamamı yanıtlanamıyor",
  LOW_CONFIDENCE: "Güven eşiği karşılanmıyor",
  RISK_DETECTED: "Kontrol gerektiren risk var",
  REVIEW_REQUIRED: "Kullanıcı incelemesi gerekiyor",
  UNSUPPORTED_CLAIM: "Doğrulanamayan ifade var",
  STOCK_CONTRADICTION: "Stok bilgileri çelişiyor",
  PRICE_CONTRADICTION: "Fiyat bilgileri çelişiyor",
  STALE_INVENTORY: "Stok bilgisi güncel değil",
  HIGH_RISK_INTENT: "Hassas konu kontrol bekliyor",
}

export function activityStatus(item: AiPerformance["recentActivity"][number]) {
  if (item.deliveryStatus === "SENT")
    return {
      label:
        item.deliveryOrigin === "AUTOMATION"
          ? "Otomatik gönderildi"
          : item.composition === "AI_EDITED"
            ? "Düzenlenerek gönderildi"
            : "Onaylanıp gönderildi",
      tone: "border-primary/20 bg-primary/10 text-primary",
    }
  if (item.deliveryStatus === "FAILED" || item.outcome === "FAILED")
    return {
      label: "İşlem başarısız",
      tone: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
    }
  if (item.deliveryStatus === "QUEUED" || item.deliveryStatus === "PROCESSING")
    return {
      label:
        item.deliveryStatus === "QUEUED"
          ? "Gönderim kuyruğunda"
          : "Gönderiliyor",
      tone: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    }
  if (item.outcome === "SUPERSEDED")
    return {
      label: "Yeni taslakla değiştirildi",
      tone: "border-border bg-muted text-muted-foreground",
    }
  if (item.decision === "DO_NOT_REPLY")
    return {
      label: "Yanıtlanmayacak",
      tone: "border-border bg-muted text-muted-foreground",
    }
  if (item.decision === "NEEDS_REVIEW")
    return {
      label: "İnceleme gerekli",
      tone: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    }
  return {
    label: "Taslak hazır",
    tone: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  }
}
