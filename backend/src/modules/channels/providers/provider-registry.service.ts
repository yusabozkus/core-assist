import { BadRequestException, Injectable } from '@nestjs/common';
import type { IntegrationEnvironment } from '../../../generated/prisma/enums';
import type {
  CatalogConnector,
  ConnectorContext,
  InventoryBatch,
  ProductBatch,
  ProviderCredentials,
  ProviderManifest,
} from './catalog-connector';
import { HepsiburadaConnector } from './hepsiburada.connector';
import { MockCatalogConnector } from './mock-catalog.connector';
import { MockQuestionConnector } from './mock-question.connector';
import { PROVIDER_MANIFESTS } from './provider-manifests';
import type {
  ProductQuestionAnswerResult,
  ProductQuestionBatch,
  ProductQuestionConnector,
} from './question-connector';
import { TrendyolConnector } from './trendyol.connector';

@Injectable()
export class ProviderRegistryService {
  private readonly manifests = new Map(
    PROVIDER_MANIFESTS.map((manifest) => [manifest.key, manifest]),
  );
  private readonly liveCatalogConnectors: Map<string, CatalogConnector>;
  private readonly liveQuestionConnectors: Map<
    string,
    ProductQuestionConnector
  >;
  private readonly catalogMode: 'mock' | 'live';
  private readonly questionMode: 'mock' | 'live';

  constructor(
    trendyolConnector: TrendyolConnector,
    hepsiburadaConnector: HepsiburadaConnector,
    private readonly mockConnector: MockCatalogConnector,
    private readonly mockQuestionConnector: MockQuestionConnector,
  ) {
    this.liveCatalogConnectors = new Map<string, CatalogConnector>([
      [trendyolConnector.providerKey, trendyolConnector],
      [hepsiburadaConnector.providerKey, hepsiburadaConnector],
    ]);
    this.liveQuestionConnectors = new Map<string, ProductQuestionConnector>([
      [trendyolConnector.providerKey, trendyolConnector],
      [hepsiburadaConnector.providerKey, hepsiburadaConnector],
    ]);
    this.catalogMode = resolveConnectorMode('CATALOG_CONNECTOR_MODE');
    this.questionMode = resolveConnectorMode(
      'QUESTION_CONNECTOR_MODE',
      this.catalogMode,
    );
  }

  getAvailableProviders(): ProviderManifest[] {
    return [...this.manifests.values()].map((manifest) => ({
      ...manifest,
      capabilities: manifest.capabilities.filter(
        (capability) =>
          (capability !== 'PRODUCT_QNA_READ' &&
            capability !== 'PRODUCT_QNA_REPLY') ||
          this.supportsProductQuestions(manifest.key),
      ),
    }));
  }

  supportsProductQuestions(providerKey: string) {
    return (
      this.manifests.has(providerKey) &&
      (this.questionMode === 'mock' ||
        this.liveQuestionConnectors.has(providerKey))
    );
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
    if (this.catalogMode === 'mock') {
      return this.mockConnector.verifyCredentials(
        providerKey,
        context.credentials,
      );
    }

    return this.getLiveCatalogConnector(providerKey).verifyCredentials(context);
  }

  async fetchProducts(
    providerKey: string,
    context: ConnectorContext,
    cursor?: string,
  ): Promise<ProductBatch> {
    if (this.catalogMode === 'mock') {
      return this.mockConnector.fetchProducts(providerKey, context);
    }

    return this.getLiveCatalogConnector(providerKey).fetchProducts(
      context,
      cursor,
    );
  }

  async fetchInventory(
    providerKey: string,
    context: ConnectorContext,
    cursor?: string,
  ): Promise<InventoryBatch> {
    if (this.catalogMode === 'mock') {
      return this.mockConnector.fetchInventory(providerKey, context);
    }

    return this.getLiveCatalogConnector(providerKey).fetchInventory(
      context,
      cursor,
    );
  }

  async fetchProductQuestions(
    providerKey: string,
    context: ConnectorContext,
    options: { cursor?: string; createdAfter: Date },
  ): Promise<ProductQuestionBatch> {
    if (this.questionMode === 'mock') {
      return this.mockQuestionConnector.fetchProductQuestions(
        providerKey,
        context,
        options,
      );
    }

    return this.getLiveQuestionConnector(providerKey).fetchProductQuestions(
      context,
      options,
    );
  }

  async sendProductQuestionAnswer(
    providerKey: string,
    context: ConnectorContext,
    externalQuestionId: string,
    answer: string,
  ): Promise<ProductQuestionAnswerResult> {
    if (this.questionMode === 'mock') {
      return this.mockQuestionConnector.sendProductQuestionAnswer(
        providerKey,
        context,
        externalQuestionId,
        answer,
      );
    }

    return this.getLiveQuestionConnector(providerKey).sendProductQuestionAnswer(
      context,
      externalQuestionId,
      answer,
    );
  }

  private getLiveCatalogConnector(providerKey: string) {
    const connector = this.liveCatalogConnectors.get(providerKey);

    if (!connector) {
      throw new BadRequestException(
        'Bu sağlayıcı için canlı katalog adaptörü bulunmuyor.',
      );
    }

    return connector;
  }

  private getLiveQuestionConnector(providerKey: string) {
    const connector = this.liveQuestionConnectors.get(providerKey);

    if (!connector) {
      throw new BadRequestException(
        'Bu sağlayıcı için canlı ürün sorusu adaptörü bulunmuyor.',
      );
    }

    return connector;
  }
}

function resolveConnectorMode(
  environmentKey: 'CATALOG_CONNECTOR_MODE' | 'QUESTION_CONNECTOR_MODE',
  fallback?: 'mock' | 'live',
) {
  const configuredMode = process.env[environmentKey]?.trim();

  if (
    configuredMode &&
    configuredMode !== 'mock' &&
    configuredMode !== 'live'
  ) {
    throw new Error(`${environmentKey} must be either mock or live.`);
  }

  if (configuredMode === 'mock' || configuredMode === 'live') {
    return configuredMode;
  }

  return fallback ?? (process.env.NODE_ENV === 'production' ? 'live' : 'mock');
}
