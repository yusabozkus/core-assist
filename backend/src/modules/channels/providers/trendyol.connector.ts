import { BadRequestException, Injectable } from '@nestjs/common';
import { IntegrationEnvironment } from '../../../generated/prisma/enums';
import type {
  CatalogConnector,
  ConnectorContext,
  InventoryBatch,
  InventoryLookup,
  NormalizedInventoryVariant,
  NormalizedProduct,
  NormalizedProductVariant,
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
export class TrendyolConnector
  implements CatalogConnector, ProductQuestionConnector
{
  readonly providerKey = 'trendyol';

  async verifyCredentials(context: ConnectorContext): Promise<void> {
    await this.requestProducts(context, '0', 1);
  }

  async fetchProducts(
    context: ConnectorContext,
    cursor = '0',
  ): Promise<ProductBatch> {
    const payload = await this.requestProducts(context, cursor, 100);
    const items = getItems(payload);
    const products = items.map(normalizeTrendyolProduct);

    return {
      products,
      nextCursor: getNextCursor(payload, cursor),
      progress: getCatalogProgress(payload, cursor),
    };
  }

  async fetchInventory(
    context: ConnectorContext,
    cursor = '0',
  ): Promise<InventoryBatch> {
    const payload = await this.requestInventory(context, cursor, 100);
    const variants = getItems(payload).flatMap(normalizeInventoryProduct);

    return {
      variants,
      nextCursor: getNextCursor(payload, cursor),
      progress: getCatalogProgress(payload, cursor),
    };
  }

  async fetchInventoryByReferences(
    context: ConnectorContext,
    lookup: InventoryLookup,
  ): Promise<InventoryBatch> {
    if (!lookup.variants.length) return { variants: [] };
    const variants: NormalizedInventoryVariant[] = [];
    const barcodes = [
      ...new Set(
        lookup.variants.flatMap((v) => (v.barcode ? [v.barcode] : [])),
      ),
    ];
    const filters: Record<string, string>[] = [];
    for (let index = 0; index < barcodes.length; index += 50) {
      filters.push({ barcodes: barcodes.slice(index, index + 50).join(',') });
    }
    for (const sku of new Set(
      lookup.variants.filter((v) => !v.barcode).map((v) => v.sku),
    )) {
      if (!sku)
        throw new Error('Inventory lookup requires a barcode or stock code.');
      filters.push({ stockCode: sku });
    }
    for (const filter of filters) {
      const payload = await this.requestInventory(context, '0', 100, filter);
      variants.push(...getItems(payload).flatMap(normalizeInventoryProduct));
    }
    return { variants };
  }

  async fetchProductQuestions(
    context: ConnectorContext,
    options: { cursor?: string; createdAfter: Date },
  ): Promise<ProductQuestionBatch> {
    const page = parsePageCursor(options.cursor);
    const endDate = new Date();
    const earliestAllowedDate = new Date(
      endDate.getTime() - TRENDYOL_QUESTION_DATE_WINDOW_MS,
    );
    const requestedStartDate =
      options.createdAfter > earliestAllowedDate
        ? options.createdAfter
        : earliestAllowedDate;
    const startDate =
      requestedStartDate > endDate ? endDate : requestedStartDate;
    const payload = await this.request(
      context,
      `/integration/qna/sellers/${encodeURIComponent(context.credentials.supplierId)}/questions/filter`,
      {
        query: {
          startDate: String(startDate.getTime()),
          endDate: String(endDate.getTime()),
          status: 'WAITING_FOR_ANSWER',
          orderByField: 'CreatedDate',
          orderByDirection: 'ASC',
          page: String(page),
          size: String(TRENDYOL_QUESTION_PAGE_SIZE),
        },
      },
    );

    return {
      questions: getItems(payload).flatMap((item) => {
        const question = normalizeTrendyolQuestion(item);
        return question ? [question] : [];
      }),
      nextCursor: getNextPageCursor(payload, page),
    };
  }

  async sendProductQuestionAnswer(
    context: ConnectorContext,
    externalQuestionId: string,
    answer: string,
  ): Promise<ProductQuestionAnswerResult> {
    const normalizedAnswer = answer.trim();

    if (normalizedAnswer.length < 10 || normalizedAnswer.length > 2000) {
      throw new BadRequestException(
        'Trendyol cevapları 10 ile 2000 karakter arasında olmalıdır.',
      );
    }

    const payload = await this.request(
      context,
      `/integration/qna/sellers/${encodeURIComponent(context.credentials.supplierId)}/questions/${encodeURIComponent(externalQuestionId)}/answers`,
      {
        method: 'POST',
        body: { text: normalizedAnswer },
      },
    );
    const externalAnswerId = firstString(payload, ['answerId', 'id']);

    if (!externalAnswerId) {
      throw new Error('Trendyol returned an invalid question answer response.');
    }

    return { externalAnswerId, answeredAt: new Date() };
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

    if (!/^\d+$/.test(page)) {
      url.searchParams.delete('page');
      url.searchParams.set('nextPageToken', page);
    }

    return this.performRequest(url, supplierId, apiKey, apiSecret);
  }

  private async requestInventory(
    context: ConnectorContext,
    cursor: string,
    size: number,
    filters: Record<string, string> = {},
  ) {
    const { supplierId, apiKey, apiSecret } = context.credentials;
    const baseUrl =
      context.environment === IntegrationEnvironment.PRODUCTION
        ? 'https://apigw.trendyol.com'
        : 'https://stageapigw.trendyol.com';
    const url = new URL(
      `/integration/product/sellers/${encodeURIComponent(supplierId)}/products/approved/inventory-and-price`,
      baseUrl,
    );
    url.searchParams.set('size', String(size));

    Object.entries(filters).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );

    if (/^\d+$/.test(cursor)) {
      url.searchParams.set('page', cursor);
    } else {
      url.searchParams.set('nextPageToken', cursor);
    }

    return this.performRequest(url, supplierId, apiKey, apiSecret, {
      signal: context.signal,
    });
  }

  private async request(
    context: ConnectorContext,
    path: string,
    options: {
      method?: 'GET' | 'POST';
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    } = {},
  ) {
    const { supplierId, apiKey, apiSecret } = context.credentials;
    const url = new URL(path, resolveTrendyolBaseUrl(context));

    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return this.performRequest(url, supplierId, apiKey, apiSecret, {
      method: options.method,
      body: options.body,
    });
  }

  private async performRequest(
    url: URL,
    supplierId: string,
    apiKey: string,
    apiSecret: string,
    options: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
      signal?: AbortSignal;
    } = {},
  ) {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'tr',
        Authorization: basicAuthorization(apiKey, apiSecret),
        'Content-Type': 'application/json',
        'User-Agent': `${supplierId} - CoreAssist`,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: options.signal ?? AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(await readProviderError(response));
    }

    const payload = asRecord(await response.json());

    if (!payload) {
      throw new Error('Trendyol returned an invalid response.');
    }

    return payload;
  }
}

const TRENDYOL_QUESTION_PAGE_SIZE = 50;
const TRENDYOL_QUESTION_DATE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function resolveTrendyolBaseUrl(context: ConnectorContext) {
  return context.environment === IntegrationEnvironment.PRODUCTION
    ? 'https://apigw.trendyol.com'
    : 'https://stageapigw.trendyol.com';
}

function getItems(payload: Record<string, unknown>) {
  return asRecordArray(payload.content ?? payload.items ?? payload.data);
}

function normalizeTrendyolProduct(item: Record<string, unknown>) {
  const variantRecords = asRecordArray(item.variants);
  const productAttributes = asRecordArray(item.attributes);
  const stockCodeCounts = countValues(
    variantRecords.map((variant) => firstString(variant, ['stockCode'])),
  );
  const variants = (variantRecords.length ? variantRecords : [item]).map(
    (variant, index) =>
      normalizeVariant(
        variant,
        item,
        productAttributes,
        stockCodeCounts,
        index,
      ),
  );
  const attributes = productAttributes
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
    .filter((url): url is string => Boolean(url))
    .map(normalizeTrendyolImageUrl);
  const externalId =
    firstString(item, [
      'productMainId',
      'contentId',
      'productContentId',
      'id',
      'barcode',
    ]) ?? variants[0].sku;
  const brand = asRecord(item.brand);
  const category = asRecord(item.category);

  return {
    externalId,
    externalUrl:
      firstString(item, ['productUrl', 'url']) ??
      variantRecords
        .map((variant) => firstString(variant, ['productUrl', 'url']))
        .find(Boolean),
    title: firstString(item, ['title', 'name']) ?? 'İsimsiz Trendyol ürünü',
    description: firstString(item, ['description']),
    brand:
      firstString(item, ['brandName']) ??
      (brand ? firstString(brand, ['name']) : undefined),
    category:
      firstString(item, ['categoryName']) ??
      (category ? firstString(category, ['name']) : undefined),
    attributes,
    images,
    sizeGuide: createNormalizedSizeGuide(item),
    variants,
    sourceUpdatedAt: firstDate(item, [
      'lastModifiedDate',
      'sellerModifiedDate',
      'lastUpdateDate',
    ]),
    rawPayload: item,
  } satisfies NormalizedProduct;
}

function createNormalizedSizeGuide(item: Record<string, unknown>) {
  const sourceUrl = firstString(item, [
    'sizeChartUrl',
    'sizeChartImageUrl',
    'sizeGuideUrl',
  ]);
  const rawText = firstString(item, [
    'sizeChartText',
    'sizeGuideText',
    'measurementTable',
  ]);

  if (!sourceUrl) return undefined;
  return { sourceUrl, rawText };
}

function normalizeVariant(
  variant: Record<string, unknown>,
  product: Record<string, unknown>,
  productAttributes: Record<string, unknown>[],
  stockCodeCounts: Map<string, number>,
  index: number,
): NormalizedProductVariant {
  const variantAttributes = asRecordArray(variant.attributes);
  const stockCode = firstString(variant, ['stockCode', 'merchantSku', 'sku']);
  const barcode = firstString(variant, ['barcode']);
  const sku =
    (stockCode && stockCodeCounts.get(stockCode) === 1
      ? stockCode
      : (barcode ?? stockCode)) ??
    `${firstString(product, ['productMainId', 'contentId', 'id']) ?? 'TY'}-${index + 1}`;
  const price = asRecord(variant.price);
  const stock = asRecord(variant.stock);

  return {
    externalId:
      firstString(variant, ['variantId', 'id', 'barcode', 'stockCode']) ?? sku,
    title: firstString(variant, ['title', 'variantName']),
    sku,
    barcode,
    color:
      firstString(variant, ['color']) ??
      findAttributeValue(variantAttributes, [
        'Renk',
        'Web Renk',
        'Web Color',
      ]) ??
      findAttributeValue(productAttributes, [
        'Renk',
        'Web Renk',
        'Web Color',
      ]) ??
      firstString(product, ['color']),
    size:
      firstString(variant, ['size']) ??
      findAttributeValue(variantAttributes, ['Beden', 'Numara']) ??
      firstString(product, ['size']),
    price: price
      ? firstNumber(price, ['salePrice', 'priceSeenByCustomer', 'listPrice'])
      : firstNumber(
          variant,
          ['salePrice', 'price'],
          firstNumber(product, ['salePrice', 'price']),
        ),
    currency: firstString(variant, ['currencyType', 'currency']) ?? 'TRY',
    stock: Math.max(
      0,
      Math.trunc(
        stock
          ? firstNumber(stock, ['quantity'])
          : firstNumber(
              variant,
              ['quantity', 'stock'],
              firstNumber(product, ['quantity', 'stock']),
            ),
      ),
    ),
    sourceUpdatedAt:
      (stock ? firstDate(stock, ['lastModifiedDate']) : undefined) ??
      firstDate(variant, [
        'stockLastModifiedDate',
        'sellerModifiedDate',
        'lastModifiedDate',
      ]) ??
      firstDate(product, [
        'stockLastModifiedDate',
        'sellerModifiedDate',
        'lastModifiedDate',
      ]),
  };
}

function normalizeInventoryProduct(
  product: Record<string, unknown>,
): NormalizedInventoryVariant[] {
  const externalProductId =
    firstString(product, [
      'productMainId',
      'contentId',
      'productContentId',
      'id',
    ]) ?? '';
  const variantRecords = asRecordArray(product.variants);
  const variants = variantRecords.length ? variantRecords : [product];
  const stockCodeCounts = countValues(
    variants.map((variant) => firstString(variant, ['stockCode'])),
  );

  const normalizedVariants: NormalizedInventoryVariant[] = [];

  for (const variant of variants) {
    const stockCode = firstString(variant, ['stockCode', 'merchantSku', 'sku']);
    const barcode = firstString(variant, ['barcode']);
    const sku =
      (stockCode && stockCodeCounts.get(stockCode) === 1
        ? stockCode
        : (barcode ?? stockCode)) ?? '';
    const externalVariantId =
      firstString(variant, ['variantId', 'id', 'barcode', 'stockCode']) ?? sku;

    if (!externalProductId || !externalVariantId || !sku) continue;

    const stockRecord = asRecord(variant.stock);
    const priceRecord = asRecord(variant.price);
    const stock = stockRecord
      ? firstOptionalNumber(stockRecord, ['quantity'])
      : firstOptionalNumber(variant, ['quantity', 'stock']);

    normalizedVariants.push({
      externalProductId,
      externalVariantId,
      sku,
      barcode,
      price: priceRecord
        ? firstOptionalNumber(priceRecord, [
            'salePrice',
            'priceSeenByCustomer',
            'listPrice',
          ])
        : firstOptionalNumber(variant, ['salePrice', 'listPrice', 'price']),
      currency: firstString(variant, ['currencyType', 'currency']),
      stock: stock === undefined ? undefined : Math.max(0, Math.trunc(stock)),
      sourceUpdatedAt:
        firstDate(variant, [
          'stockLastModifiedDate',
          'sellerModifiedDate',
          'lastModifiedDate',
        ]) ??
        (stockRecord
          ? firstDate(stockRecord, ['lastModifiedDate'])
          : undefined),
    });
  }

  return normalizedVariants;
}

function normalizeTrendyolQuestion(
  item: Record<string, unknown>,
): ProductQuestionBatch['questions'][number] | null {
  const externalId = firstString(item, ['id', 'questionId']);
  const externalProductId = firstString(item, [
    'productMainId',
    'contentId',
    'barcode',
  ]);
  const text = firstString(item, ['text', 'question']);
  const createdAt = firstDate(item, ['creationDate', 'createdAt']);

  if (!externalId || !externalProductId || !text || !createdAt) return null;

  return {
    externalId,
    externalProductId,
    externalCustomerId: firstString(item, ['customerId']),
    customerName:
      item.showUserName === false
        ? undefined
        : firstString(item, ['userName', 'customerName']),
    text,
    createdAt,
    rawPayload: item,
  };
}

function findAttributeValue(
  attributes: Record<string, unknown>[],
  names: string[],
) {
  const normalizedNames = new Set(names.map(normalizeLabel));

  for (const attribute of attributes) {
    const name = firstString(attribute, ['attributeName', 'name']);
    if (!name || !normalizedNames.has(normalizeLabel(name))) continue;

    const value = firstString(attribute, [
      'attributeValue',
      'attributeValueName',
      'value',
    ]);
    if (value) return value;
  }

  return undefined;
}

function normalizeLabel(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .trim();
}

function countValues(values: Array<string | undefined>) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return counts;
}

function normalizeTrendyolImageUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return new URL(url, 'https://cdn.dsmcdn.com').toString();
}

function parsePageCursor(cursor: string | undefined) {
  if (!cursor) return 0;
  if (!/^\d+$/.test(cursor)) {
    throw new Error('Trendyol question cursor is invalid.');
  }
  return Number(cursor);
}

function getNextPageCursor(payload: Record<string, unknown>, page: number) {
  const responsePage = firstNumber(payload, ['page'], page);
  const totalPages = firstNumber(payload, ['totalPages'], responsePage + 1);
  return responsePage + 1 < totalPages ? String(responsePage + 1) : undefined;
}

function getNextCursor(
  payload: Record<string, unknown>,
  currentCursor: string,
) {
  const token = firstString(payload, ['nextPageToken']);

  if (token) return token;
  if (!/^\d+$/.test(currentCursor)) return undefined;

  const page = Number(currentCursor);
  const totalPages = firstNumber(payload, ['totalPages'], page + 1);
  return page + 1 < totalPages ? String(page + 1) : undefined;
}

function getCatalogProgress(
  payload: Record<string, unknown>,
  currentCursor: string,
) {
  const totalPages = firstOptionalNumber(payload, ['totalPages']);
  if (!totalPages || totalPages <= 0) return undefined;

  const fallbackPage = /^\d+$/.test(currentCursor) ? Number(currentCursor) : 0;
  const page = firstNumber(payload, ['page'], fallbackPage);
  return Math.min(1, Math.max(0, (page + 1) / totalPages));
}
