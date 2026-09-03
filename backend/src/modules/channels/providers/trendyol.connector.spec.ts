import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { IntegrationEnvironment } from '../../../generated/prisma/enums';
import type { ConnectorContext } from './catalog-connector';
import { TrendyolConnector } from './trendyol.connector';

const context: ConnectorContext = {
  environment: IntegrationEnvironment.SANDBOX,
  credentials: {
    supplierId: '123456',
    apiKey: 'contract-test-key',
    apiSecret: 'contract-test-secret',
  },
};

describe('TrendyolConnector contract', () => {
  let connector: TrendyolConnector;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    connector = new TrendyolConnector();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('normalizes the approved Products V2 response', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('trendyol-approved-products.json')),
    );

    const result = await connector.fetchProducts(context);

    expect(requestUrl(fetchSpy)).toBe(
      'https://stageapigw.trendyol.com/integration/product/sellers/123456/products/approved?page=0&size=100',
    );
    expect(requestHeaders(fetchSpy)).toMatchObject({
      Accept: 'application/json',
      'Accept-Language': 'tr',
      Authorization: `Basic ${Buffer.from('contract-test-key:contract-test-secret').toString('base64')}`,
      'User-Agent': '123456 - CoreAssist',
    });
    expect(result.nextCursor).toBe('approved-products-next-token');
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      externalId: 'D1902AX25SM',
      externalUrl:
        'https://www.trendyol.com/defacto/regular-fit-gomlek-p-12715815',
      brand: 'DeFacto',
      category: 'Gömlek',
      images: [
        'https://cdn.dsmcdn.com/ty100/product/media/images/1.jpg',
        'https://cdn.dsmcdn.com/ty100/product/media/images/2.jpg',
      ],
    });
    expect(result.products[0].variants).toEqual([
      expect.objectContaining({
        externalId: '70228905',
        sku: '8683526124546',
        barcode: '8683526124546',
        color: 'Beyaz',
        size: 'S',
        price: 599.99,
        currency: 'TRY',
        stock: 12,
        sourceUpdatedAt: new Date(1774948958844),
      }),
      expect.objectContaining({
        externalId: '70229505',
        sku: '8683526124553',
        barcode: '8683526124553',
        color: 'Beyaz',
        size: 'M',
        price: 599.99,
        currency: 'TRY',
        stock: 0,
        sourceUpdatedAt: new Date(1774948959844),
      }),
    ]);
  });

  it('normalizes nested stock and price fields from inventory responses', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('trendyol-inventory.json')),
    );

    const result = await connector.fetchInventory(context);

    expect(requestUrl(fetchSpy)).toBe(
      'https://stageapigw.trendyol.com/integration/product/sellers/123456/products/approved/inventory-and-price?size=100&page=0',
    );
    expect(result.nextCursor).toBeUndefined();
    expect(result.variants).toEqual([
      {
        externalProductId: 'D1902AX25SM',
        externalVariantId: '70228905',
        sku: '8683526124546',
        barcode: '8683526124546',
        price: 579.99,
        currency: undefined,
        stock: 8,
        sourceUpdatedAt: new Date(1774949958844),
      },
      {
        externalProductId: 'D1902AX25SM',
        externalVariantId: '70229505',
        sku: '8683526124553',
        barcode: '8683526124553',
        price: 579.99,
        currency: undefined,
        stock: 2,
        sourceUpdatedAt: new Date(1774949959844),
      },
    ]);
  });

  it('fetches waiting questions in the supported date window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('trendyol-questions.json')),
    );

    const result = await connector.fetchProductQuestions(context, {
      createdAfter: new Date('2026-09-01T08:30:00.000Z'),
    });
    const url = new URL(requestUrl(fetchSpy));

    expect(url.origin + url.pathname).toBe(
      'https://stageapigw.trendyol.com/integration/qna/sellers/123456/questions/filter',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startDate: String(new Date('2026-09-01T08:30:00.000Z').getTime()),
      endDate: String(new Date('2026-09-03T12:00:00.000Z').getTime()),
      status: 'WAITING_FOR_ANSWER',
      orderByField: 'CreatedDate',
      orderByDirection: 'ASC',
      page: '0',
      size: '50',
    });
    expect(result.nextCursor).toBe('1');
    expect(result.questions).toEqual([
      expect.objectContaining({
        externalId: '44001122',
        externalProductId: 'D1902AX25SM',
        externalCustomerId: '99112233',
        customerName: 'Mehmet T.',
        text: 'Ürün regular kalıp mı?',
        createdAt: new Date(1788424200000),
      }),
      expect.objectContaining({
        externalId: '44001123',
        externalProductId: 'D1902AX25SM',
        externalCustomerId: '99112234',
        customerName: undefined,
      }),
    ]);
  });

  it('limits old question queries to the latest fourteen days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        content: [],
        page: 0,
        size: 50,
        totalElements: 0,
        totalPages: 0,
      }),
    );

    await connector.fetchProductQuestions(context, {
      createdAfter: new Date('2026-01-01T00:00:00.000Z'),
    });
    const url = new URL(requestUrl(fetchSpy));

    expect(url.searchParams.get('startDate')).toBe(
      String(new Date('2026-08-20T12:00:00.000Z').getTime()),
    );
    expect(url.searchParams.get('endDate')).toBe(
      String(new Date('2026-09-03T12:00:00.000Z').getTime()),
    );
  });

  it('posts a trimmed answer and returns the external answer id', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('trendyol-question-answer.json')),
    );

    const result = await connector.sendProductQuestionAnswer(
      context,
      '44001122',
      '  Merhabalar, ürünümüz regular kalıptır.  ',
    );
    const [, request] = fetchSpy.mock.calls[0];

    expect(requestUrl(fetchSpy)).toBe(
      'https://stageapigw.trendyol.com/integration/qna/sellers/123456/questions/44001122/answers',
    );
    expect(request).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        text: 'Merhabalar, ürünümüz regular kalıptır.',
      }),
    });
    expect(result).toEqual({
      externalAnswerId: '55002211',
      answeredAt: new Date('2026-09-03T12:00:00.000Z'),
    });
  });

  it('rejects answers outside Trendyol length limits before sending', async () => {
    await expect(
      connector.sendProductQuestionAnswer(context, '44001122', 'Çok kısa'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces provider status and response body for failed requests', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('{"errors":[{"message":"Rate limit exceeded"}]}', {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(connector.fetchProducts(context)).rejects.toThrow(
      'Provider request failed with status 429: {"errors":[{"message":"Rate limit exceeded"}]}',
    );
  });
});

function readFixture(name: string) {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'contracts', name), 'utf8'),
  ) as Record<string, unknown>;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestUrl(fetchSpy: jest.SpiedFunction<typeof fetch>) {
  const [request] = fetchSpy.mock.calls[0];
  if (request instanceof URL) return request.toString();
  if (request instanceof Request) return request.url;
  return request;
}

function requestHeaders(fetchSpy: jest.SpiedFunction<typeof fetch>) {
  const [, request] = fetchSpy.mock.calls[0];
  return request?.headers as Record<string, string>;
}
