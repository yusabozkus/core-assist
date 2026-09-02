import Image from "next/image"

import { cn } from "@/lib/utils"
import type { IntegrationProvider } from "@/types/channel"

type ProviderIdentity = Pick<IntegrationProvider, "key" | "name" | "image">

type ProviderLogoProps = Omit<
  React.ComponentPropsWithoutRef<"span">,
  "children"
> & {
  provider: string | ProviderIdentity
  imageClassName?: string
  sizes?: string
}

const PROVIDER_PRESENTATION: Record<string, { name: string; image: string }> = {
  trendyol: {
    name: "Trendyol",
    image: "/merchants/trendyol.webp",
  },
  hepsiburada: {
    name: "Hepsiburada",
    image: "/merchants/hepsiburada.webp",
  },
  instagram: {
    name: "Instagram",
    image: "/merchants/instagram.webp",
  },
  whatsapp: {
    name: "WhatsApp",
    image: "/merchants/whatsapp.webp",
  },
  woocommerce: {
    name: "WooCommerce",
    image: "/merchants/woo.webp",
  },
}

export function ProviderLogo({
  provider,
  className,
  imageClassName,
  sizes = "48px",
  ...props
}: ProviderLogoProps) {
  const presentation = resolveProviderPresentation(provider)

  return (
    <span
      className={cn(
        "relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-xs",
        className
      )}
      {...props}
    >
      {presentation.image ? (
        <Image
          src={presentation.image}
          alt={`${presentation.name} logosu`}
          fill
          sizes={sizes}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <span className="text-xs font-semibold text-slate-700 uppercase">
          {getProviderInitials(presentation.name)}
        </span>
      )}
    </span>
  )
}

function resolveProviderPresentation(provider: string | ProviderIdentity) {
  const providerKey = typeof provider === "string" ? provider : provider.key
  const registeredProvider = PROVIDER_PRESENTATION[providerKey]

  if (typeof provider === "string") {
    return (
      registeredProvider ?? {
        name: humanizeProviderKey(providerKey),
        image: "",
      }
    )
  }

  return {
    name:
      provider.name ||
      registeredProvider?.name ||
      humanizeProviderKey(providerKey),
    image: provider.image || registeredProvider?.image || "",
  }
}

function humanizeProviderKey(providerKey: string) {
  const normalizedName = providerKey.replaceAll(/[-_]/g, " ").trim()

  if (!normalizedName) return "Pazaryeri"

  return normalizedName.replace(/\b\p{L}/gu, (character) =>
    character.toLocaleUpperCase("tr-TR")
  )
}

function getProviderInitials(providerName: string) {
  return providerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toLocaleUpperCase("tr-TR")
}
