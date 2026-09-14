export type LandingScreenshot = {
  id: string
  label: string
  title: string
  description: string
  src: string
  available?: boolean
  alt: string
}

export const LANDING_SCREENSHOTS = [
  {
    id: "inbox",
    label: "Gelen kutusu",
    title: "Her sorunun yanında, ihtiyacınız olan bilgi.",
    description:
      "Müşteri sorusu, ilgili ürün ve AI taslağı aynı ekranda. Yanıtları inceleyin, düzenleyin ve gönderim durumunu takip edin.",
    src: "/landing/screenshots/inbox.webp",
    alt: "Core Asistan gelen kutusunda müşteri sorusu, ürün bilgisi ve AI yanıt taslağı",
  },
  {
    id: "product-detail",
    label: "Ürün detayları",
    title: "Yanıtın arkasındaki ürünü bütün detaylarıyla görün.",
    description:
      "Görseller, açıklamalar, özellikler, beden tablosu ve varyantlar. AI'ın yararlandığı ürün bilgileri elinizin altında.",
    src: "/landing/screenshots/product-detail.webp",
    alt: "Core Asistan ürün detayında ürün görselleri, özellikler, beden tablosu ve varyantlar",
  },
  {
    id: "ai-performance",
    label: "AI performansı",
    title: "Otomasyonun işinize katkısını takip edin.",
    description:
      "Hazırlanan taslakları, gönderilen yanıtları ve inceleme gerektiren soruları görün. Yanıt akışını verilerle değerlendirin.",
    src: "/landing/screenshots/ai-performance.webp",
    alt: "Core Asistan AI performansında yanıt akışı, taslaklar ve otomasyon istatistikleri",
  },
] as const satisfies readonly LandingScreenshot[]
