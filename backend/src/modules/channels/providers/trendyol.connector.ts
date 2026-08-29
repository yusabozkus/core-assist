import { Injectable } from '@nestjs/common';
import { IntegrationEnvironment } from '../../../generated/prisma/enums';
import type {
  CatalogConnector,
  ConnectorContext,
  NormalizedProduct,
  NormalizedProductVariant,
  ProductBatch,
} from './catalog-connector';
import {
  asRecord,
  asRecordArray,
  basicAuthorization,
  firstNumber,
  firstString,
  readProviderError,
} from './connector-utils';

@Injectable()
export class TrendyolConnector implements CatalogConnector {
  readonly providerKey = 'trendyol';

  async verifyCredentials(context: ConnectorContext): Promise<void> {
    await this.requestProducts(context, '0', 1);
  }

  async fetchProducts(
    context: ConnectorContext,
    cursor = '0',
  ): Promise<ProductBatch> {
    const payload = await this.requestProducts(context, cursor, 100);
    const products = getItems(payload).map(normalizeTrendyolProduct);
    const page = Number(cursor);
    const totalPages = firstNumber(payload, ['totalPages'], page + 1);

    return {
      products,
      nextCursor: page + 1 < totalPages ? String(page + 1) : undefined,
    };
  }

  private async requestProducts(
    context: ConnectorContext,
    page: string,
    size: number,
  ) {
    const { supplierId, apiKey, apiSecret } = context.credentials;
    const baseUrl =
      context.environment === IntegrationEnvironment.PRODUCTION
        ? 'https://apigw.trendyol.com'
        : 'https://stageapigw.trendyol.com';
    const url = new URL(
      `/integration/product/sellers/${encodeURIComponent(supplierId)}/products/approved`,
      baseUrl,
    );
    url.searchParams.set('page', page);
    url.searchParams.set('size', String(size));

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: basicAuthorization(apiKey, apiSecret),
        'User-Agent': `${supplierId} - CoreAssist`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(await readProviderError(response));
    }

    const payload = asRecord(await response.json());

    if (!payload) {
      throw new Error('Trendyol returned an invalid product response.');
    }

    return payload;
  }
}

function getItems(payload: Record<string, unknown>) {
  return asRecordArray(payload.content ?? payload.items ?? payload.data);
}

function normalizeTrendyolProduct(item: Record<string, unknown>) {
  const variantRecords = asRecordArray(item.variants);
  const variants = (variantRecords.length ? variantRecords : [item]).map(
    (variant, index) => normalizeVariant(variant, item, index),
  );
  const attributes = asRecordArray(item.attributes)
    .map((attribute) => ({
      name: firstString(attribute, ['attributeName', 'name']) ?? '',
      value:
        firstString(attribute, [
          'attributeValue',
          'value',
          'attributeValueName',
        ]) ?? '',
    }))
    .filter((attribute) => attribute.name && attribute.value);
  const images = asRecordArray(item.images)
    .map((image) => firstString(image, ['url', 'imageUrl']))
    .filter((url): url is string => Boolean(url));
  const externalId =
    firstString(item, [
      'contentId',
      'productContentId',
      'id',
      'productMainId',
      'barcode',
    ]) ?? variants[0].sku;

  return {
    externalId,
    externalUrl: firstString(item, ['productUrl', 'url']),
    title: firstString(item, ['title', 'name']) ?? 'İsimsiz Trendyol ürünü',
    description: firstString(item, ['description']),
    brand: firstString(item, ['brand', 'brandName']),
    category: firstString(item, ['categoryName', 'category']),
    attributes,
    images,
    variants,
    rawPayload: item,
  } satisfies NormalizedProduct;
}

function normalizeVariant(
  variant: Record<string, unknown>,
  product: Record<string, unknown>,
  index: number,
): NormalizedProductVariant {
  const sku =
    firstString(variant, ['stockCode', 'merchantSku', 'sku', 'barcode']) ??
    `${firstString(product, ['productMainId', 'contentId', 'id']) ?? 'TY'}-${index + 1}`;

  return {
    title: firstString(variant, ['title', 'variantName']),
    sku,
    barcode: firstString(variant, ['barcode']),
    color: firstString(variant, ['color']) ?? firstString(product, ['color']),
    size: firstString(variant, ['size']) ?? firstString(product, ['size']),
    price: firstNumber(
      variant,
      ['salePrice', 'price'],
      firstNumber(product, ['salePrice', 'price']),
    ),
    currency: firstString(variant, ['currencyType', 'currency']) ?? 'TRY',
    stock: Math.max(
      0,
      Math.trunc(
        firstNumber(
          variant,
          ['quantity', 'stock'],
          firstNumber(product, ['quantity', 'stock']),
        ),
      ),
    ),
  };
}
