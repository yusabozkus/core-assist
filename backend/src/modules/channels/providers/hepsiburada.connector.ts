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
import { createHepsiburadaMenSizeGuide } from './hepsiburada-men-size-guide';

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
  const externalUrl = firstString(item, ['productUrl', 'url']);
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
  const title =
    firstString(item, ['title', 'name', 'productName']) ??
    'İsimsiz Hepsiburada ürünü';
  const category = firstString(item, ['categoryName', 'category']);
  const sizeGuide =
    createNormalizedSizeGuide(item, externalUrl) ??
    (isMenClothing(title, category, attributes)
      ? createHepsiburadaMenSizeGuide(category ?? title)
      : undefined);

  return {
    externalId:
      firstString(item, ['listingId', 'id', 'hbSku', 'productId']) ?? sku,
    externalUrl,
    title,
    description: firstString(item, ['description']),
    brand: firstString(item, ['brand', 'brandName']),
    category,
    attributes,
    images,
    sizeGuide,
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
