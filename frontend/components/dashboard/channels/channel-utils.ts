import type { IntegrationProvider } from "@/types/channel"

export function getProvider(
  providers: IntegrationProvider[],
  providerKey: string
): IntegrationProvider {
  return (
    providers.find((provider) => provider.key === providerKey) ?? {
      key: providerKey,
      name: providerKey,
      type: "COMMERCE",
      image: "",
      description: "Pazaryeri katalog bağlantısı",
      capabilities: ["CATALOG_READ", "INVENTORY_READ"],
      environments: ["SANDBOX", "PRODUCTION"],
      credentialFields: [],
    }
  )
}
