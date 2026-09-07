import type {
  BillingCycle,
  InvoiceRecord,
  InvoiceStatus,
  SubscriptionPlan,
} from "@/types/billing"

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description:
      "Tek mağazayla başlayın, günlük sorulara daha hızlı yanıt verin.",
    monthlyPrice: 2300,
    questions: 1500,
    stores: 1,
    connections: 2,
    products: 5000,
    features: [
      "AI taslakları ve güvenli otomasyon",
      "Yanıt tonu ve uzunluk ayarları",
      "E-posta desteği",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description:
      "Büyüyen kataloğunuzu ve birden fazla mağazanızı birlikte yönetin.",
    monthlyPrice: 6000,
    questions: 5000,
    stores: 5,
    connections: 10,
    products: 25000,
    highlighted: true,
    features: [
      "Starter planındaki tüm özellikler",
      "Gelişmiş yanıt ve marka ayarları",
      "Öncelikli destek",
    ],
  },
  {
    id: "business",
    name: "Business",
    description: "Yoğun soru trafiğine ve geniş operasyonlara yer açın.",
    monthlyPrice: 10000,
    questions: 15000,
    stores: 15,
    connections: null,
    products: 100000,
    features: [
      "Growth planındaki tüm özellikler",
      "Gelişmiş AI kuralları ve analizler",
      "Öncelikli destek ve hızlı dönüş",
    ],
  },
]

// Display fixtures until the billing integration is connected.
export const BILLING_PREVIEW = {
  plan: SUBSCRIPTION_PLANS[1],
  cycle: "monthly" as BillingCycle,
  period: "15 Ağustos – 15 Eylül 2026",
  renewsAt: "15 Eylül 2026",
  paymentMethod: "Visa •••• 4242",
  cardExpiry: "08/29",
  company: "North Clothing Teknoloji ve Ticaret Ltd. Şti.",
  address: "Maslak Mah. Büyükdere Cad. No: 123, Sarıyer / İstanbul",
  taxNumber: "123 456 7890",
  usage: { questions: 3420, stores: 2, connections: 3, products: 18640 },
} as const

function createInvoice(
  sequence: string,
  period: string,
  issuedAt: string,
  year = "2026",
  plan = "Growth",
  subtotal = 6000,
  status: InvoiceStatus = "paid"
): InvoiceRecord {
  const tax = subtotal * 0.2
  return {
    id: `${year}-${sequence}`,
    number: `CA-${year}-${sequence}`,
    plan: `${plan} · Aylık plan`,
    period,
    issuedAt,
    year,
    subtotal,
    tax,
    total: subtotal + tax,
    status,
    paymentMethod: BILLING_PREVIEW.paymentMethod,
  }
}

export const BILLING_INVOICES: readonly InvoiceRecord[] = [
  createInvoice("0192", "15 Ağustos – 15 Eylül 2026", "15 Ağustos 2026"),
  createInvoice("0171", "15 Temmuz – 15 Ağustos 2026", "15 Temmuz 2026"),
  createInvoice("0148", "15 Haziran – 15 Temmuz 2026", "15 Haziran 2026"),
  createInvoice("0126", "15 Mayıs – 15 Haziran 2026", "15 Mayıs 2026"),
  createInvoice("0104", "15 Nisan – 15 Mayıs 2026", "15 Nisan 2026"),
  createInvoice("0081", "15 Mart – 15 Nisan 2026", "15 Mart 2026"),
  createInvoice("0057", "15 Şubat – 15 Mart 2026", "15 Şubat 2026"),
  createInvoice("0032", "15 Ocak – 15 Şubat 2026", "15 Ocak 2026"),
  createInvoice(
    "0418",
    "15 Aralık 2025 – 15 Ocak 2026",
    "15 Aralık 2025",
    "2025",
    "Starter",
    2300
  ),
  createInvoice(
    "0391",
    "15 Kasım – 15 Aralık 2025",
    "15 Kasım 2025",
    "2025",
    "Starter",
    2300,
    "refunded"
  ),
]
