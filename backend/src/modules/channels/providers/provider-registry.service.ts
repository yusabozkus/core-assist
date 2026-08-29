import { BadRequestException, Injectable } from '@nestjs/common';
import type { IntegrationEnvironment } from '../../../generated/prisma/enums';
import type {
  CatalogConnector,
  ConnectorContext,
  ProductBatch,
  ProviderCredentials,
  ProviderManifest,
} from './catalog-connector';
import { HepsiburadaConnector } from './hepsiburada.connector';
import { MockCatalogConnector } from './mock-catalog.connector';
import { PROVIDER_MANIFESTS } from './provider-manifests';
import { TrendyolConnector } from './trendyol.connector';

@Injectable()
export class ProviderRegistryService {
  private readonly manifests = new Map(
    PROVIDER_MANIFESTS.map((manifest) => [manifest.key, manifest]),
  );
  private readonly liveConnectors: Map<string, CatalogConnector>;
  private readonly mode: 'mock' | 'live';

  constructor(
    trendyolConnector: TrendyolConnector,
    hepsiburadaConnector: HepsiburadaConnector,
    private readonly mockConnector: MockCatalogConnector,
  ) {
    this.liveConnectors = new Map<string, CatalogConnector>([
      [trendyolConnector.providerKey, trendyolConnector],
      [hepsiburadaConnector.providerKey, hepsiburadaConnector],
    ]);
    const configuredMode = process.env.CATALOG_CONNECTOR_MODE?.trim();

    if (
      configuredMode &&
      configuredMode !== 'mock' &&
      configuredMode !== 'live'
    ) {
      throw new Error('CATALOG_CONNECTOR_MODE must be either mock or live.');
    }

    this.mode =
      configuredMode === 'live' || process.env.NODE_ENV === 'production'
        ? 'live'
        : 'mock';
  }

  getAvailableProviders(): ProviderManifest[] {
    return [...this.manifests.values()];
  }

  getManifest(providerKey: string): ProviderManifest {
    const manifest = this.manifests.get(providerKey);

    if (!manifest) {
      throw new BadRequestException('Desteklenmeyen entegrasyon sağlayıcısı.');
    }

    return manifest;
  }

  validateCredentials(
    providerKey: string,
    environment: IntegrationEnvironment,
    credentials: Record<string, unknown>,
  ): ProviderCredentials {
    const manifest = this.getManifest(providerKey);

    if (!manifest.environments.includes(environment)) {
      throw new BadRequestException('Seçilen bağlantı ortamı desteklenmiyor.');
    }

    const normalized: ProviderCredentials = {};

    for (const field of manifest.credentialFields) {
      const value = credentials[field.key];

      if (typeof value !== 'string' || !value.trim()) {
        throw new BadRequestException(`${field.label} alanı zorunludur.`);
      }

      normalized[field.key] = value.trim();
    }

    return normalized;
  }

  async verifyCredentials(
    providerKey: string,
    context: ConnectorContext,
  ): Promise<void> {
    if (this.mode === 'mock') {
      return this.mockConnector.verifyCredentials(
        providerKey,
        context.credentials,
      );
    }

    return this.getLiveConnector(providerKey).verifyCredentials(context);
  }

  async fetchProducts(
    providerKey: string,
    context: ConnectorContext,
    cursor?: string,
  ): Promise<ProductBatch> {
    if (this.mode === 'mock') {
      return this.mockConnector.fetchProducts(providerKey, context);
    }

    return this.getLiveConnector(providerKey).fetchProducts(context, cursor);
  }

  private getLiveConnector(providerKey: string) {
    const connector = this.liveConnectors.get(providerKey);

    if (!connector) {
      throw new BadRequestException(
        'Bu sağlayıcı için canlı katalog adaptörü bulunmuyor.',
      );
    }

    return connector;
  }
}
