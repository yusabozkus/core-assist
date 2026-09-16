import type { SubscriptionPlan } from "@/types/billing"

export const BILLING_TRIAL = {
  days: 10,
  questions: 100,
  stores: 1,
  products: 1000,
} as const

export const INCLUDED_MARKETPLACES = "Trendyol ve Hepsiburada"

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description:
      "Tek mağazayla başlayın, günlük sorulara daha hızlı yanıt verin.",
    questions: 1500,
    stores: 1,
    members: 1,
    products: 5000,
    support: "2 iş günü hedefli ticket desteği",
    features: [
      "Tüm desteklenen pazaryerleri",
      "AI taslakları ve güvenli otomatik gönderim",
      "AI performansı ve güven analizleri",
      "Bilgi merkezi ve pazaryeri istisnaları",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description:
      "Büyüyen kataloğunuzu ve birden fazla mağazanızı birlikte yönetin.",
    questions: 5000,
    stores: 5,
    members: 3,
    products: 25000,
    support: "1 iş günü hedefli öncelikli ticket desteği",
    highlighted: true,
    features: [
      "Starter planındaki tüm özellikler",
      "Birden fazla mağazada merkezi yönetim",
      "Her mağaza için ayrı bilgi ve AI ayarları",
      "Öncelikli destek",
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Yoğun soru trafiğine ve geniş operasyonlara yer açın.",
    questions: 15000,
    stores: 15,
    members: 10,
    products: 100000,
    support: "Aynı iş günü öncelikli destek ve kurulum görüşmesi",
    features: [
      "Growth planındaki tüm özellikler",
      "Yüksek hacimli mağaza operasyonları",
      "Bilgi merkezi için başlangıç kurulum desteği",
      "Aynı iş günü hedefli öncelikli destek",
    ],
  },
]
