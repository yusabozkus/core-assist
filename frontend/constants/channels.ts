import type { ChannelProvider, ChannelType } from "@/types/channel"

export type ChannelCatalogItem = {
  provider: ChannelProvider
  name: string
  category: string
  description: string
  image: string
  type: ChannelType
}

export const CHANNEL_CATALOG: ReadonlyArray<ChannelCatalogItem> = [
  {
    provider: "TRENDYOL",
    name: "Trendyol",
    category: "Pazaryeri",
    description: "Sipariş, ürün ve stok operasyonlarını tek yerden yönetin.",
    image: "/merchants/trendyol.webp",
    type: "COMMERCE",
  },
  {
    provider: "HEPSIBURADA",
    name: "Hepsiburada",
    category: "Pazaryeri",
    description: "Mağaza operasyonlarınızı CoreAssist ile senkronize edin.",
    image: "/merchants/hepsiburada.webp",
    type: "COMMERCE",
  },
  {
    provider: "INSTAGRAM",
    name: "Instagram",
    category: "Sosyal medya",
    description: "Sosyal satış görüşmelerini mağazanızla ilişkilendirin.",
    image: "/merchants/instagram.webp",
    type: "SOCIAL",
  },
  {
    provider: "WHATSAPP",
    name: "WhatsApp Business",
    category: "Mesajlaşma",
    description: "Müşteri mesajlarını ve satış taleplerini merkezileştirin.",
    image: "/merchants/whatsapp.webp",
    type: "MESSAGING",
  },
  {
    provider: "WOOCOMMERCE",
    name: "WooCommerce",
    category: "E-ticaret altyapısı",
    description: "Web mağazanızdaki ürün ve siparişleri senkronize edin.",
    image: "/merchants/woo.webp",
    type: "COMMERCE",
  },
]

export function getChannelCatalogItem(provider: ChannelProvider) {
  const channel = CHANNEL_CATALOG.find(
    (candidate) => candidate.provider === provider
  )

  if (!channel) {
    throw new Error(`Unsupported channel provider: ${provider}`)
  }

  return channel
}
