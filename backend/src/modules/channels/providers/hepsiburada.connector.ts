import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { IntegrationEnvironment } from '../../../generated/prisma/enums';
import type {
  CatalogConnector,
  ConnectorContext,
  InventoryBatch,
  NormalizedInventoryVariant,
  NormalizedProduct,
  ProductBatch,
} from './catalog-connector';
import type {
  ProductQuestionAnswerResult,
  ProductQuestionBatch,
  ProductQuestionConnector,
} from './question-connector';
import {
  asRecord,
  asRecordArray,
  basicAuthorization,
  firstDate,
  firstNumber,
  firstOptionalNumber,
  firstString,
  readProviderError,
} from './connector-utils';

@Injectable()
export class HepsiburadaConnector
  implements CatalogConnector, ProductQuestionConnector
{
  readonly providerKey = 'hepsiburada';

  async verifyCredentials(context: ConnectorContext): Promise<void> {
    await this.requestListings(context, '0', 1);
  }

  async fetchProducts(
    context: ConnectorContext,
    cursor = '0',
  ): Promise<ProductBatch> {
    const payload = await this.requestListings(context, cursor, 100);
    const listings = getListings(payload);
    const offset = Number(cursor);

    return {
      products: listings.map(normalizeHepsiburadaListing),
      nextCursor: listings.length === 100 ? String(offset + 100) : undefined,
    };
  }

  async fetchInventory(
    context: ConnectorContext,
    cursor = '0',
  ): Promise<InventoryBatch> {
    const payload = await this.requestListings(context, cursor, 100);
    const listings = getListings(payload);
    const offset = Number(cursor);

    return {
      variants: listings.map(normalizeHepsiburadaInventory),
      nextCursor: listings.length === 100 ? String(offset + 100) : undefined,
    };
  }

  fetchProductQuestions(): Promise<ProductQuestionBatch> {
    throw new ServiceUnavailableException(
      'Hepsiburada canlı ürün sorusu adaptörü henüz yapılandırılmadı.',
    );
  }

  sendProductQuestionAnswer(): Promise<ProductQuestionAnswerResult> {
    throw new ServiceUnavailableException(
      'Hepsiburada canlı ürün sorusu yanıtlama adaptörü henüz yapılandırılmadı.',
    );
  }

  private async requestListings(
    context: ConnectorContext,
    offset: string,
    limit: number,
  ) {
    const { merchantId, developerUser, serviceKey } = context.credentials;
    const host =
      context.environment === IntegrationEnvironment.PRODUCTION
        ? 'https://listing-external.hepsiburada.com'
        : 'https://listing-external-sit.hepsiburada.com';
    const url = new URL(
      `/listings/merchantid/${encodeURIComponent(merchantId)}`,
      host,
    );
    url.searchParams.set('offset', offset);
    url.searchParams.set('limit', String(limit));

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: basicAuthorization(developerUser, serviceKey),
        'Content-Type': 'application/json',
        'User-Agent': 'CoreAssist',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(await readProviderError(response));
    }

    const payload = asRecord(await response.json());

    if (!payload) {
      throw new Error('Hepsiburada returned an invalid listing response.');
    }

    return payload;
  }
}

function getListings(payload: Record<string, unknown>) {
  return asRecordArray(
    payload.listings ?? payload.items ?? payload.content ?? payload.data,
  );
}

function normalizeHepsiburadaListing(
  item: Record<string, unknown>,
): NormalizedProduct {
  const sku =
    firstString(item, ['merchantSku', 'sku', 'hbSku', 'barcode']) ??
    `HB-${firstString(item, ['id', 'productId']) ?? 'UNKNOWN'}`;
  const attributesRecord = asRecord(item.attributes);
  const attributes = attributesRecord
    ? Object.entries(attributesRecord)
        .filter((entry): entry is [string, string] =>
          ['string', 'number', 'boolean'].includes(typeof entry[1]),
        )
        .map(([name, value]) => ({ name, value: String(value) }))
    : [];
  const imageRecords = asRecordArray(item.images);
  const images = imageRecords
    .map((image) => firstString(image, ['url', 'imageUrl']))
    .filter((url): url is string => Boolean(url));

  return {
    externalId:
      firstString(item, ['listingId', 'id', 'hbSku', 'productId']) ?? sku,
    externalUrl: firstString(item, ['productUrl', 'url']),
    title:
      firstString(item, ['title', 'name', 'productName']) ??
      'İsimsiz Hepsiburada ürünü',
    description: firstString(item, ['description']),
    brand: firstString(item, ['brand', 'brandName']),
    category: firstString(item, ['categoryName', 'category']),
    attributes,
    images,
    variants: [
      {
        externalId:
          firstString(item, ['listingId', 'id', 'hbSku', 'merchantSku']) ?? sku,
        title: firstString(item, ['variantName', 'listingName']),
        sku,
        barcode: firstString(item, ['barcode']),
        color: firstString(item, ['color', 'colour']),
        size: firstString(item, ['size']),
        price: firstNumber(item, ['price', 'salePrice']),
        currency: firstString(item, ['currency', 'currencyType']) ?? 'TRY',
        stock: Math.max(
          0,
          Math.trunc(
            firstNumber(item, ['availableStock', 'stock', 'quantity']),
          ),
        ),
        sourceUpdatedAt: firstDate(item, [
          'lastModifiedDate',
          'updatedAt',
          'lastUpdateDate',
        ]),
      },
    ],
    sourceUpdatedAt: firstDate(item, [
      'lastModifiedDate',
      'updatedAt',
      'lastUpdateDate',
    ]),
    rawPayload: item,
  };
}

function normalizeHepsiburadaInventory(
  item: Record<string, unknown>,
): NormalizedInventoryVariant {
  const sku =
    firstString(item, ['merchantSku', 'sku', 'hbSku', 'barcode']) ??
    `HB-${firstString(item, ['id', 'productId']) ?? 'UNKNOWN'}`;
  const externalProductId =
    firstString(item, ['listingId', 'id', 'hbSku', 'productId']) ?? sku;
  const stock = firstOptionalNumber(item, [
    'availableStock',
    'stock',
    'quantity',
  ]);

  return {
    externalProductId,
    externalVariantId:
      firstString(item, ['listingId', 'id', 'hbSku', 'merchantSku']) ?? sku,
    sku,
    barcode: firstString(item, ['barcode']),
    price: firstOptionalNumber(item, ['price', 'salePrice']),
    currency: firstString(item, ['currency', 'currencyType']),
    stock: stock === undefined ? undefined : Math.max(0, Math.trunc(stock)),
    sourceUpdatedAt: firstDate(item, [
      'lastModifiedDate',
      'updatedAt',
      'lastUpdateDate',
    ]),
  };
}
