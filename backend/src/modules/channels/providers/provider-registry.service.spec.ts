import { HepsiburadaConnector } from './hepsiburada.connector';
import { MockCatalogConnector } from './mock-catalog.connector';
import { MockQuestionConnector } from './mock-question.connector';
import { ProviderRegistryService } from './provider-registry.service';
import { TrendyolConnector } from './trendyol.connector';

describe('ProviderRegistryService capabilities', () => {
  const originalCatalogMode = process.env.CATALOG_CONNECTOR_MODE;
  const originalQuestionMode = process.env.QUESTION_CONNECTOR_MODE;

  afterEach(() => {
    restoreEnvironment('CATALOG_CONNECTOR_MODE', originalCatalogMode);
    restoreEnvironment('QUESTION_CONNECTOR_MODE', originalQuestionMode);
  });

  it('exposes question capabilities for every provider in mock mode', () => {
    process.env.CATALOG_CONNECTOR_MODE = 'mock';
    process.env.QUESTION_CONNECTOR_MODE = 'mock';
    const registry = createRegistry();

    expect(registry.supportsProductQuestions('trendyol')).toBe(true);
    expect(registry.supportsProductQuestions('hepsiburada')).toBe(true);
    expect(
      registry
        .getAvailableProviders()
        .find((provider) => provider.key === 'hepsiburada')?.capabilities,
    ).toEqual(
      expect.arrayContaining(['PRODUCT_QNA_READ', 'PRODUCT_QNA_REPLY']),
    );
  });

  it('exposes implemented live question capabilities', () => {
    process.env.CATALOG_CONNECTOR_MODE = 'live';
    process.env.QUESTION_CONNECTOR_MODE = 'live';
    const registry = createRegistry();
    const providers = registry.getAvailableProviders();
    const trendyol = providers.find((provider) => provider.key === 'trendyol');
    const hepsiburada = providers.find(
      (provider) => provider.key === 'hepsiburada',
    );

    expect(registry.supportsProductQuestions('trendyol')).toBe(true);
    expect(registry.supportsProductQuestions('hepsiburada')).toBe(true);
    expect(trendyol?.capabilities).toEqual(
      expect.arrayContaining(['PRODUCT_QNA_READ', 'PRODUCT_QNA_REPLY']),
    );
    expect(hepsiburada?.capabilities).toEqual(
      expect.arrayContaining(['PRODUCT_QNA_READ', 'PRODUCT_QNA_REPLY']),
    );
  });
});

function createRegistry() {
  return new ProviderRegistryService(
    new TrendyolConnector(),
    new HepsiburadaConnector(),
    new MockCatalogConnector(),
    new MockQuestionConnector(),
  );
}

function restoreEnvironment(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
