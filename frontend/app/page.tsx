import type { Metadata } from "next"

import { LandingPage } from "@/components/landing/landing-page"

export const metadata: Metadata = {
  title: "CoreAssist | Pazaryeri ürün soruları için AI operasyonu",
  description:
    "Trendyol ve Hepsiburada ürün sorularını katalog, varyant, beden tablosu ve güncel stok bilgisiyle yanıtlayın. Güvenli cevapları otomatik gönderin, belirsiz olanları ekibinizle inceleyin.",
}

export default function HomePage() {
  return <LandingPage />
}
