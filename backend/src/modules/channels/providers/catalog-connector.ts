import type { IntegrationEnvironment } from '../../../generated/prisma/enums';

export type ProviderCredentials = Record<string, string>;

export type NormalizedProductVariant = {
  title?: string;
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  price: number;
  currency: string;
  stock: number;
};

export type NormalizedProduct = {
  externalId: string;
  externalUrl?: string;
  title: string;
  description?: string;
  brand?: string;
  category?: string;
  attributes: Array<{ name: string; value: string }>;
  images: string[];
  variants: NormalizedProductVariant[];
  rawPayload: Record<string, unknown>;
};

export type ProductBatch = {
  products: NormalizedProduct[];
  nextCursor?: string;
};

export type ConnectorContext = {
  environment: IntegrationEnvironment;
  credentials: ProviderCredentials;
};

export interface CatalogConnector {
  readonly providerKey: string;
  verifyCredentials(context: ConnectorContext): Promise<void>;
  fetchProducts(
    context: ConnectorContext,
    cursor?: string,
  ): Promise<ProductBatch>;
}

export type CredentialFieldDefinition = {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder: string;
};

export type ProviderManifest = {
  key: string;
  name: string;
  type: 'COMMERCE';
  image: string;
  description: string;
  environments: Array<'SANDBOX' | 'PRODUCTION'>;
  credentialFields: CredentialFieldDefinition[];
};
