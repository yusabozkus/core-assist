import type { ProductAnswerFact } from "@/types/question"
import type { AiPerformance } from "@/types/ai-performance"
import { questionStatusTones } from "@/components/dashboard/inbox/question-status-tones"

export const formatCount = (value: number) => value.toLocaleString("tr-TR")
export const formatPercent = (value: number) =>
  `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
export const boundedPercent = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0

export const confidenceExplanation =
  "AI yanıtı için hesaplanan güven puanıdır; bağımsız olarak ölçülmüş bir doğruluk oranı değildir. Yüksek puan, yanıtın kesin doğru olduğunu garanti etmez."

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
  if (item.deliveryStatus === "REVIEW_REQUIRED")
    return {
      label: "Teslimat kontrolü gerekli",
      tone: questionStatusTones.deliveryReview,
    }
  if (item.deliveryStatus === "SENT")
    return {
      label:
        item.deliveryOrigin === "AUTOMATION"
          ? "Otomatik gönderildi"
          : item.composition === "AI_EDITED"
            ? "Düzenlenerek gönderildi"
            : "Onaylanıp gönderildi",
      tone: questionStatusTones.answered,
    }
  if (item.deliveryStatus === "FAILED" || item.outcome === "FAILED")
    return {
      label: "İşlem başarısız",
      tone: questionStatusTones.failed,
    }
  if (item.deliveryStatus === "QUEUED" || item.deliveryStatus === "PROCESSING")
    return {
      label:
        item.deliveryStatus === "QUEUED"
          ? "Gönderim kuyruğunda"
          : "Gönderiliyor",
      tone: questionStatusTones.deliveryPending,
    }
  if (item.outcome === "SUPERSEDED")
    return {
      label: "Yeni taslakla değiştirildi",
      tone: questionStatusTones.neutral,
    }
  if (item.answerability === "OUT_OF_SCOPE")
    return {
      label: "Kapsam dışı",
      tone: questionStatusTones.outOfScope,
    }
  if (item.decision === "DO_NOT_REPLY")
    return {
      label: "Yanıtlanmayacak",
      tone: questionStatusTones.failed,
    }
  if (item.decision === "NEEDS_REVIEW")
    return {
      label: "İnceleme gerekli",
      tone: questionStatusTones.review,
    }
  return {
    label:
      item.decision === "READY_FOR_SEND" ? "Gönderime hazır" : "Taslak hazır",
    tone:
      item.decision === "READY_FOR_SEND"
        ? questionStatusTones.ready
        : questionStatusTones.draft,
  }
}
