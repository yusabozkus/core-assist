import { Module } from '@nestjs/common';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { HepsiburadaConnector } from '../channels/providers/hepsiburada.connector';
import { MockCatalogConnector } from '../channels/providers/mock-catalog.connector';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { TrendyolConnector } from '../channels/providers/trendyol.connector';

const integrationProviders = [
  CredentialsEncryptionService,
  ProviderRegistryService,
  MockCatalogConnector,
  TrendyolConnector,
  HepsiburadaConnector,
];

@Module({
  providers: integrationProviders,
  exports: integrationProviders,
})
export class IntegrationsModule {}
