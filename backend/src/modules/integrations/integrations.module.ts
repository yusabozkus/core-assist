import { Module } from '@nestjs/common';
import { CredentialsEncryptionService } from '../channels/credentials-encryption.service';
import { HepsiburadaConnector } from '../channels/providers/hepsiburada.connector';
import { MockCatalogConnector } from '../channels/providers/mock-catalog.connector';
import { MockQuestionConnector } from '../channels/providers/mock-question.connector';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { TrendyolConnector } from '../channels/providers/trendyol.connector';

const integrationProviders = [
  CredentialsEncryptionService,
  ProviderRegistryService,
  MockCatalogConnector,
  MockQuestionConnector,
  TrendyolConnector,
  HepsiburadaConnector,
];

@Module({
  providers: integrationProviders,
  exports: integrationProviders,
})
export class IntegrationsModule {}
