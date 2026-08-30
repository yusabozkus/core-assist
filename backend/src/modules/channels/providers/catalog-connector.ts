import type { IntegrationEnvironment } from '../../../generated/prisma/enums';

export type ProviderCredentials = Record<string, string>;

export type NormalizedProductVariant = {
  externalId: string;
  title?: string;
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  price: number;
  currency: string;
  stock: number;
  sourceUpdatedAt?: Date;
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
  sourceUpdatedAt?: Date;
  rawPayload: Record<string, unknown>;
};

export type ProductBatch = {
  products: NormalizedProduct[];
  nextCursor?: string;
};

export type NormalizedInventoryVariant = {
  externalProductId: string;
  externalVariantId: string;
  sku: string;
  barcode?: string;
  price?: number;
  currency?: string;
  stock?: number;
  sourceUpdatedAt?: Date;
};

export type InventoryBatch = {
  variants: NormalizedInventoryVariant[];
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
  fetchInventory(
    context: ConnectorContext,
    cursor?: string,
  ): Promise<InventoryBatch>;
}

export type CommerceCapability =
  'CATALOG_READ' | 'INVENTORY_READ' | 'PRODUCT_QNA_READ' | 'PRODUCT_QNA_REPLY';

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
  capabilities: CommerceCapability[];
  environments: Array<'SANDBOX' | 'PRODUCTION'>;
  credentialFields: CredentialFieldDefinition[];
};
