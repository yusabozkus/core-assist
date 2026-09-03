import { BadRequestException, Injectable } from '@nestjs/common';
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
import { createHepsiburadaMenSizeGuide } from './hepsiburada-men-size-guide';

@Injectable()
export class HepsiburadaConnector
  implements CatalogConnector, ProductQuestionConnector
{
  readonly providerKey = 'hepsiburada';

  async verifyCredentials(context: ConnectorContext): Promise<void> {
    await this.requestListings(context, 0, 1);
  }

  async fetchProducts(
    context: ConnectorContext,
    cursor = '0',
  ): Promise<ProductBatch> {
    const offset = parseOffsetCursor(cursor);
    const payload = await this.requestListings(context, offset, 100);
    const listings = getListings(payload);

    return {
      products: groupListings(listings).map(normalizeHepsiburadaListingGroup),
      nextCursor: getNextOffset(payload, offset, 100, listings.length),
    };
  }

  async fetchInventory(
    context: ConnectorContext,
    cursor = '0',
  ): Promise<InventoryBatch> {
    const offset = parseOffsetCursor(cursor);
    const payload = await this.requestListings(context, offset, 100);
    const listings = getListings(payload);

    return {
      variants: listings.map(normalizeHepsiburadaInventory),
      nextCursor: getNextOffset(payload, offset, 100, listings.length),
    };
  }

  async fetchProductQuestions(
    context: ConnectorContext,
    options: { cursor?: string; createdAfter: Date },
  ): Promise<ProductQuestionBatch> {
    const page = parsePageCursor(options.cursor);
    const endDate = new Date();
    const startDate =
      options.createdAfter > endDate ? endDate : options.createdAfter;
    const payload = await this.requestQuestions(context, '', {
      query: {
        status: 'Open',
        minCreatedAt: startDate.toISOString(),
        maxCreatedAt: endDate.toISOString(),
        page: String(page),
        size: String(HEPSIBURADA_QUESTION_PAGE_SIZE),
      },
    });
    const items = getQuestionItems(payload);

    return {
      questions: items.flatMap((item) => {
        const question = normalizeHepsiburadaQuestion(item);
        return question ? [question] : [];
      }),
      nextCursor: getNextQuestionPage(
        payload,
        page,
        HEPSIBURADA_QUESTION_PAGE_SIZE,
        items.length,
      ),
    };
  }

  async sendProductQuestionAnswer(
    context: ConnectorContext,
    externalQuestionId: string,
    answer: string,
  ): Promise<ProductQuestionAnswerResult> {
    const normalizedAnswer = answer.trim();

    if (!normalizedAnswer || normalizedAnswer.length > 2000) {
      throw new BadRequestException(
        'Hepsiburada cevapları 1 ile 2000 karakter arasında olmalıdır.',
      );
    }

    const payload = await this.requestQuestions(
      context,
      `/${encodeURIComponent(externalQuestionId)}/answer`,
      {
        method: 'POST',
        body: { answer: normalizedAnswer },
      },
    );
    const response = asRecord(payload);

    return {
      externalAnswerId: response
        ? firstString(response, ['answerId', 'id', 'number'])
        : undefined,
      answeredAt: new Date(),
    };
  }

  private async requestListings(
    context: ConnectorContext,
    offset: number,
    limit: number,
  ) {
    const url = new URL(
      `/listings/merchantid/${encodeURIComponent(context.credentials.merchantId)}`,
      resolveListingBaseUrl(context),
    );
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));
    const payload = await this.performRequest(context, url);
    const record = asRecord(payload);

    if (!record) {
      throw new Error('Hepsiburada returned an invalid listing response.');
    }

    return record;
  }

  private requestQuestions(
    context: ConnectorContext,
    suffix: string,
    options: {
      method?: 'GET' | 'POST';
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    } = {},
  ) {
    const url = new URL(
      `/api/v1.0/issues${suffix}`,
      resolveQuestionBaseUrl(context),
    );

    Object.entries(options.query ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return this.performRequest(context, url, {
      method: options.method,
      body: options.body,
      headers: { merchantId: context.credentials.merchantId },
    });
  }

  private async performRequest(
    context: ConnectorContext,
    url: URL,
    options: {
      method?: 'GET' | 'POST';
      body?: Record<string, unknown>;
      headers?: Record<string, string>;
    } = {},
  ): Promise<unknown> {
    const { developerUser, serviceKey } = context.credentials;
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: basicAuthorization(developerUser, serviceKey),
        'Content-Type': 'application/json',
        'User-Agent': 'CoreAssist',
        ...options.headers,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(await readProviderError(response));
    }

    const body = await response.text();
    if (!body) return undefined;

    try {
      return JSON.parse(body) as unknown;
    } catch {
      return body;
    }
  }
}

const HEPSIBURADA_QUESTION_PAGE_SIZE = 50;

function resolveListingBaseUrl(context: ConnectorContext) {
  return context.environment === IntegrationEnvironment.PRODUCTION
    ? 'https://listing-external.hepsiburada.com'
    : 'https://listing-external-sit.hepsiburada.com';
}

function resolveQuestionBaseUrl(context: ConnectorContext) {
  return context.environment === IntegrationEnvironment.PRODUCTION
    ? 'https://api-asktoseller-merchant.hepsiburada.com'
    : 'https://api-asktoseller-merchant-sit.hepsiburada.com';
}

function getListings(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  return asRecordArray(
    payload.listings ??
      payload.items ??
      payload.content ??
      data?.listings ??
      data?.items ??
      payload.data,
  );
}

function groupListings(listings: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();

  for (const listing of listings) {
    const externalProductId = getExternalProductId(listing);
    const group = groups.get(externalProductId) ?? [];
    group.push(listing);
    groups.set(externalProductId, group);
  }

  return [...groups.values()];
}

function normalizeHepsiburadaListingGroup(
  items: Record<string, unknown>[],
): NormalizedProduct {
  const item = items[0];
  const externalUrl = firstString(item, ['productUrl', 'url']);
  const attributes = normalizeAttributes(item.attributes);
  const images = [...new Set(items.flatMap(normalizeImages))];
  const title =
    firstString(item, ['title', 'name', 'productName']) ??
    'İsimsiz Hepsiburada ürünü';
  const category = readNamedValue(item.category, item.categoryName);
  const sizeGuide =
    createNormalizedSizeGuide(item, externalUrl) ??
    (isMenClothing(title, category, attributes)
      ? createHepsiburadaMenSizeGuide(category ?? title)
      : undefined);

  return {
    externalId: getExternalProductId(item),
    externalUrl,
    title,
    description: firstString(item, ['description']),
    brand: readNamedValue(item.brand, item.brandName),
    category,
    attributes,
    images,
    sizeGuide,
    variants: items.map(normalizeHepsiburadaVariant),
    sourceUpdatedAt: latestDate(items),
    rawPayload: { listings: items },
  };
}

function normalizeHepsiburadaVariant(item: Record<string, unknown>) {
  const attributes = normalizeAttributes(item.attributes);
  const sku = getMerchantSku(item);

  return {
    externalId: getExternalVariantId(item),
    title: firstString(item, ['variantName', 'listingName', 'productName']),
    sku,
    barcode: firstString(item, ['barcode', 'ean']),
    color:
      firstString(item, ['color', 'colour']) ??
      findAttribute(attributes, ['renk', 'color', 'colour']),
    size:
      firstString(item, ['size']) ??
      findAttribute(attributes, ['beden', 'size']),
    price: readMoney(item, ['price', 'salePrice']),
    currency: readCurrency(item) ?? 'TRY',
    stock: Math.max(
      0,
      Math.trunc(firstNumber(item, ['availableStock', 'stock', 'quantity'])),
    ),
    sourceUpdatedAt: firstDate(item, [
      'lastModifiedDate',
      'updatedAt',
      'lastUpdateDate',
    ]),
  };
}

function isMenClothing(
  title: string,
  category: string | undefined,
  attributes: Array<{ name: string; value: string }>,
) {
  const searchable = [
    title,
    category,
    ...attributes.flatMap((attribute) => [attribute.name, attribute.value]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR');

  return (
    /\berkek\b/.test(searchable) &&
    /giyim|t-shirt|tişört|gömlek|mont|ceket|sweatshirt|kazak|pantolon|jean/.test(
      searchable,
    )
  );
}

function createNormalizedSizeGuide(
  item: Record<string, unknown>,
  productUrl?: string,
) {
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
  const structuredData =
    normalizeStructuredSizeGuide(
      item.sizeChart ??
        item.sizeGuide ??
        item.measurementTable ??
        item.sizeChartData ??
        item.measurements,
    ) ?? normalizeTextSizeGuide(rawText);

  if (!sourceUrl && !structuredData) return undefined;
  return {
    sourceUrl: sourceUrl ?? productUrl ?? 'https://www.hepsiburada.com/',
    rawText,
    structuredData,
  };
}

function normalizeStructuredSizeGuide(value: unknown) {
  const parsedValue = parseJsonValue(value);
  const record = asRecord(parsedValue);
  const rawRows = Array.isArray(parsedValue)
    ? parsedValue
    : record
      ? (record.rows ?? record.data ?? record.items ?? record.values)
      : undefined;
  const rowRecords = asRecordArray(rawRows);

  if (rowRecords.length === 0) return undefined;

  const declaredHeaders = record
    ? toStringArray(record.headers ?? record.columns ?? record.columnNames)
    : [];
  const rows = rowRecords.flatMap((row) => {
    const label = firstString(row, ['label', 'size', 'beden', 'name', 'title']);

    if (!label) return [];

    const measurementRecords = asRecordArray(
      row.measurements ?? row.cells ?? row.values,
    );
    const measurements = measurementRecords.length
      ? measurementRecords.flatMap((measurement, index) => {
          const name =
            firstString(measurement, ['name', 'label', 'title', 'key']) ??
            declaredHeaders[index];
          const measurementValue = firstString(measurement, [
            'value',
            'text',
            'label',
          ]);
          return name && measurementValue
            ? [{ name, value: measurementValue }]
            : [];
        })
      : Object.entries(row).flatMap(([name, measurementValue]) => {
          if (
            ['label', 'size', 'beden', 'name', 'title'].includes(name) ||
            !['string', 'number'].includes(typeof measurementValue)
          ) {
            return [];
          }
          return [{ name, value: String(measurementValue) }];
        });

    return measurements.length ? [{ label, measurements }] : [];
  });

  if (rows.length === 0) return undefined;

  const headers = declaredHeaders.length
    ? declaredHeaders
    : [
        ...new Set(
          rows.flatMap((row) =>
            row.measurements.map((measurement) => measurement.name),
          ),
        ),
      ];
  const serialized = JSON.stringify(parsedValue).toLocaleLowerCase('tr-TR');
  const unit = serialized.includes('cm')
    ? ('CM' as const)
    : serialized.includes('inch') || serialized.includes('inç')
      ? ('INCH' as const)
      : ('UNKNOWN' as const);

  return {
    title:
      (record && firstString(record, ['title', 'name'])) ?? 'Beden tablosu',
    unit,
    headers,
    rows,
    notes: record ? toStringArray(record.notes ?? record.instructions) : [],
    confidence: 1,
  };
}

function normalizeTextSizeGuide(value: string | undefined) {
  if (!value) return undefined;

  const htmlRows = [...value.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(
    (match) =>
      [...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(
        (cell) => stripMarkup(cell[1]),
      ),
  );
  const tableRows = htmlRows.filter((row) => row.length > 1);

  if (tableRows.length > 1) {
    return createStructuredTable(tableRows[0], tableRows.slice(1));
  }

  const markdownRows = value
    .split(/\r?\n/)
    .map((line) =>
      line
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .filter(
      (row) => row.length > 1 && !row.every((cell) => /^:?-{3,}:?$/.test(cell)),
    );

  return markdownRows.length > 1
    ? createStructuredTable(markdownRows[0], markdownRows.slice(1))
    : undefined;
}

function createStructuredTable(headers: string[], values: string[][]) {
  const labelIndex = Math.max(
    headers.findIndex((header) =>
      /^(?:beden|size|s-m-l(?:\s+ölçüler)?)$/i.test(header.trim()),
    ),
    0,
  );
  const measurementHeaders = headers.filter((_, index) => index !== labelIndex);
  const rows = values.flatMap((row) => {
    const label = row[labelIndex];
    if (!label) return [];

    return [
      {
        label,
        measurements: headers.flatMap((header, index) =>
          index !== labelIndex && row[index]
            ? [{ name: header, value: row[index] }]
            : [],
        ),
      },
    ];
  });

  if (measurementHeaders.length === 0 || rows.length === 0) return undefined;

  const serialized = `${headers.join(' ')} ${values.flat().join(' ')}`;
  return {
    title: 'Beden tablosu',
    unit: /\bcm\b/i.test(serialized) ? ('CM' as const) : ('UNKNOWN' as const),
    headers: measurementHeaders,
    rows,
    notes: [],
    confidence: 1,
  };
}

function stripMarkup(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonValue(value: unknown) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();

  if (!normalized.startsWith('{') && !normalized.startsWith('[')) {
    return undefined;
  }

  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    return undefined;
  }
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      return [String(entry)];
    }

    const record = asRecord(entry);
    const text = record
      ? firstString(record, ['name', 'label', 'title', 'value'])
      : undefined;
    return text ? [text] : [];
  });
}

function normalizeHepsiburadaInventory(
  item: Record<string, unknown>,
): NormalizedInventoryVariant {
  const stock = firstOptionalNumber(item, [
    'availableStock',
    'stock',
    'quantity',
  ]);

  return {
    externalProductId: getExternalProductId(item),
    externalVariantId: getExternalVariantId(item),
    sku: getMerchantSku(item),
    barcode: firstString(item, ['barcode', 'ean']),
    price: readOptionalMoney(item, ['price', 'salePrice']),
    currency: readCurrency(item),
    stock: stock === undefined ? undefined : Math.max(0, Math.trunc(stock)),
    sourceUpdatedAt: firstDate(item, [
      'lastModifiedDate',
      'updatedAt',
      'lastUpdateDate',
    ]),
  };
}

function parseOffsetCursor(cursor: string) {
  const offset = Number(cursor);

  if (!Number.isInteger(offset) || offset < 0) {
    throw new BadRequestException('Hepsiburada sayfalama anahtarı geçersiz.');
  }

  return offset;
}

function parsePageCursor(cursor: string | undefined) {
  if (cursor === undefined) return 0;
  const page = Number(cursor);

  if (!Number.isInteger(page) || page < 0) {
    throw new BadRequestException(
      'Hepsiburada soru sayfalama anahtarı geçersiz.',
    );
  }

  return page;
}

function getNextOffset(
  payload: Record<string, unknown>,
  offset: number,
  limit: number,
  itemCount: number,
) {
  const totalCount = firstOptionalNumber(payload, [
    'totalCount',
    'totalElements',
    'count',
  ]);
  const nextOffset = offset + itemCount;

  if (totalCount !== undefined) {
    return nextOffset < totalCount ? String(nextOffset) : undefined;
  }

  return itemCount === limit ? String(offset + limit) : undefined;
}

function getQuestionItems(payload: unknown) {
  if (Array.isArray(payload)) return asRecordArray(payload);
  const record = asRecord(payload);
  if (!record) return [];
  const data = asRecord(record.data);

  return asRecordArray(
    record.items ??
      record.issues ??
      record.content ??
      data?.items ??
      data?.issues ??
      record.data,
  );
}

function getNextQuestionPage(
  payload: unknown,
  page: number,
  size: number,
  itemCount: number,
) {
  const record = asRecord(payload);
  const data = record ? asRecord(record.data) : null;
  const metadata = data ?? record;
  const totalPages = metadata
    ? firstOptionalNumber(metadata, ['totalPages', 'pageCount'])
    : undefined;

  if (totalPages !== undefined) {
    return page + 1 < totalPages ? String(page + 1) : undefined;
  }

  const totalCount = metadata
    ? firstOptionalNumber(metadata, ['totalCount', 'totalElements', 'count'])
    : undefined;

  if (totalCount !== undefined) {
    return (page + 1) * size < totalCount ? String(page + 1) : undefined;
  }

  return itemCount === size ? String(page + 1) : undefined;
}

function normalizeHepsiburadaQuestion(item: Record<string, unknown>) {
  const product = asRecord(item.product);
  const externalId = firstString(item, ['number', 'id', 'issueNumber']);
  const externalProductId =
    firstString(item, [
      'productSku',
      'merchantSku',
      'hepsiburadaSku',
      'hbSku',
      'productId',
    ]) ??
    (product
      ? firstString(product, [
          'productSku',
          'merchantSku',
          'hepsiburadaSku',
          'hbSku',
          'productId',
          'id',
        ])
      : undefined);
  const text = firstString(item, ['text', 'question', 'issueText']);
  const createdAt = firstDate(item, [
    'createdDate',
    'createdAt',
    'creationDate',
  ]);

  if (!externalId || !externalProductId || !text || !createdAt) {
    return undefined;
  }

  return {
    externalId,
    externalProductId,
    externalCustomerId: firstString(item, [
      'customerId',
      'userId',
      'customerNumber',
    ]),
    customerName: firstString(item, [
      'customerName',
      'userName',
      'displayName',
    ]),
    text,
    createdAt,
    rawPayload: item,
  };
}

function getExternalProductId(item: Record<string, unknown>) {
  return (
    firstString(item, [
      'productId',
      'variantGroupId',
      'variantGroupID',
      'listingGroupId',
      'hepsiburadaSku',
      'hbSku',
      'listingId',
      'id',
      'merchantSku',
    ]) ?? 'HB-UNKNOWN'
  );
}

function getExternalVariantId(item: Record<string, unknown>) {
  return (
    firstString(item, [
      'hepsiburadaSku',
      'hbSku',
      'listingId',
      'id',
      'merchantSku',
      'sku',
      'barcode',
    ]) ?? getMerchantSku(item)
  );
}

function getMerchantSku(item: Record<string, unknown>) {
  return (
    firstString(item, [
      'merchantSku',
      'sku',
      'hepsiburadaSku',
      'hbSku',
      'barcode',
    ]) ?? `HB-${firstString(item, ['id', 'productId']) ?? 'UNKNOWN'}`
  );
}

function normalizeAttributes(value: unknown) {
  const record = asRecord(value);

  if (record) {
    return Object.entries(record).flatMap(([name, rawValue]) => {
      const nested = asRecord(rawValue);
      const normalizedValue =
        typeof rawValue === 'string' ||
        typeof rawValue === 'number' ||
        typeof rawValue === 'boolean'
          ? String(rawValue)
          : nested
            ? firstString(nested, ['value', 'name', 'label'])
            : undefined;
      return normalizedValue ? [{ name, value: normalizedValue }] : [];
    });
  }

  return asRecordArray(value).flatMap((attribute) => {
    const name = firstString(attribute, ['name', 'key', 'label']);
    const attributeValue = firstString(attribute, ['value', 'displayValue']);
    return name && attributeValue ? [{ name, value: attributeValue }] : [];
  });
}

function normalizeImages(item: Record<string, unknown>) {
  const fromArray = Array.isArray(item.images)
    ? item.images.flatMap((image) => {
        if (typeof image === 'string' && image.trim()) return [image.trim()];
        const record = asRecord(image);
        const url = record
          ? firstString(record, ['url', 'imageUrl', 'link'])
          : undefined;
        return url ? [url] : [];
      })
    : [];
  const numbered = Object.entries(item).flatMap(([key, value]) =>
    /^image\d+$/i.test(key) && typeof value === 'string' && value.trim()
      ? [value.trim()]
      : [],
  );
  const primary = firstString(item, ['imageUrl', 'image']);

  return [...fromArray, ...numbered, ...(primary ? [primary] : [])];
}

function findAttribute(
  attributes: Array<{ name: string; value: string }>,
  names: string[],
) {
  return attributes.find((attribute) =>
    names.includes(attribute.name.toLocaleLowerCase('tr-TR')),
  )?.value;
}

function readNamedValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    const record = asRecord(value);
    if (record) {
      const text = firstString(record, ['name', 'value', 'label']);
      if (text) return text;
    }
  }

  return undefined;
}

function readOptionalMoney(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    const record = asRecord(value);
    if (record) {
      const amount = firstOptionalNumber(record, ['amount', 'value']);
      if (amount !== undefined) return amount;
    }
  }

  return firstOptionalNumber(item, keys);
}

function readMoney(item: Record<string, unknown>, keys: string[]) {
  return readOptionalMoney(item, keys) ?? 0;
}

function readCurrency(item: Record<string, unknown>) {
  for (const key of ['price', 'salePrice']) {
    const record = asRecord(item[key]);
    if (record) {
      const currency = firstString(record, ['currency', 'currencyType']);
      if (currency) return currency;
    }
  }

  return firstString(item, ['currency', 'currencyType']);
}

function latestDate(items: Record<string, unknown>[]) {
  return items
    .map((item) =>
      firstDate(item, ['lastModifiedDate', 'updatedAt', 'lastUpdateDate']),
    )
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => right.getTime() - left.getTime())[0];
}
