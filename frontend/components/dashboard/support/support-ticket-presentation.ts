import type {
  SupportTicketCategory,
  SupportTicketImpact,
  SupportTicketStatus,
} from "@/types/support"

export const SUPPORT_CATEGORY_OPTIONS: Array<{
  value: SupportTicketCategory
  label: string
  description: string
}> = [
  {
    value: "CHANNELS",
    label: "Kanal ve senkronizasyon",
    description: "Bağlantı, katalog veya soru senkronizasyonu",
  },
  {
    value: "AI_AUTOMATION",
    label: "AI ve otomasyon",
    description: "Taslaklar, otomatik gönderim ve yanıt davranışı",
  },
  {
    value: "CATALOG_INVENTORY",
    label: "Ürün ve stok",
    description: "Ürün eşleşmesi, varyant veya stok bilgisi",
  },
  {
    value: "BILLING_ACCOUNT",
    label: "Plan ve ödeme",
    description: "Abonelik, kota, ödeme veya fatura",
  },
  {
    value: "TEAM_ACCESS",
    label: "Hesap ve ekip",
    description: "Giriş, davet, rol veya erişim",
  },
  {
    value: "OTHER",
    label: "Diğer",
    description: "Yukarıdaki konuların dışında kalan talepler",
  },
]

export const SUPPORT_IMPACT_OPTIONS: Array<{
  value: SupportTicketImpact
  label: string
  description: string
}> = [
  {
    value: "QUESTION",
    label: "Yardıma ihtiyacım var",
    description: "Bir özelliği kullanmak veya anlamak istiyorum.",
  },
  {
    value: "PARTIAL",
    label: "Bazı işlemler çalışmıyor",
    description: "Sorun var ancak diğer işlemlere devam edebiliyorum.",
  },
  {
    value: "BLOCKED",
    label: "Operasyonum durdu",
    description: "Temel işlemleri sürdüremiyorum.",
  },
]

export const SUPPORT_STATUS: Record<
  SupportTicketStatus,
  { label: string; tone: "default" | "warning" | "success" | "outline" }
> = {
  OPEN: { label: "Açık", tone: "success" },
  IN_PROGRESS: { label: "İnceleniyor", tone: "default" },
  WAITING_CUSTOMER: { label: "Yanıtınız bekleniyor", tone: "warning" },
  RESOLVED: { label: "Çözüldü", tone: "success" },
  CLOSED: { label: "Kapatıldı", tone: "outline" },
}

export function getSupportCategoryLabel(category: SupportTicketCategory) {
  return (
    SUPPORT_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.label ?? category
  )
}
