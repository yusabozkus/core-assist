import Image from "next/image"

import type { IntegrationProvider } from "@/types/channel"

export function ProviderLogo({ provider }: { provider: IntegrationProvider }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white shadow-xs">
      <Image
        src={provider.image}
        alt={`${provider.name} logosu`}
        width={48}
        height={48}
        className="size-full object-cover"
      />
    </span>
  )
}
