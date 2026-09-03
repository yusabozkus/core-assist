import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { IntegrationEnvironment } from '../../../generated/prisma/enums';
import type { ConnectorContext } from './catalog-connector';
import { HepsiburadaConnector } from './hepsiburada.connector';

const context: ConnectorContext = {
  environment: IntegrationEnvironment.SANDBOX,
  credentials: {
    merchantId: 'merchant-123',
    developerUser: 'contract-test-user',
    serviceKey: 'contract-test-key',
  },
};

describe('HepsiburadaConnector contract', () => {
  let connector: HepsiburadaConnector;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    connector = new HepsiburadaConnector();
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('groups listings as one normalized product with multiple variants', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('hepsiburada-listings.json')),
    );

    const result = await connector.fetchProducts(context);

    expect(requestUrl(fetchSpy)).toBe(
      'https://listing-external-sit.hepsiburada.com/listings/merchantid/merchant-123?offset=0&limit=100',
    );
    expect(requestHeaders(fetchSpy)).toMatchObject({
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from('contract-test-user:contract-test-key').toString('base64')}`,
      'User-Agent': 'CoreAssist',
    });
    expect(result.nextCursor).toBeUndefined();
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      externalId: 'HBCV00009U88OT',
      title: 'Regular Fit Polo Yaka Bubble Kısa Kollu Tişört F6265AX25SM',
      brand: 'DeFacto',
      category: 'T-Shirt',
      images: [
        'https://productimages.hepsiburada.net/s/777/424-600/110001173018652.jpg',
        'https://productimages.hepsiburada.net/s/777/424-600/110001173018653.jpg',
        'https://productimages.hepsiburada.net/s/777/424-600/110001173018654.jpg',
      ],
      sourceUpdatedAt: new Date('2026-09-04T08:05:00.000Z'),
    });
    expect(result.products[0].variants).toEqual([
      expect.objectContaining({
        externalId: 'HBCV00009U88OT-S',
        sku: 'F6265AX25SM-S',
        barcode: '8692200100001',
        color: 'Yeşil-GN654',
        size: 'S',
        price: 210,
        currency: 'TRY',
        stock: 4,
      }),
      expect.objectContaining({
        externalId: 'HBCV00009U88OT-M',
        sku: 'F6265AX25SM-M',
        size: 'M',
        price: 219.9,
        stock: 2,
      }),
    ]);
  });

  it('normalizes inventory identifiers, price and stock', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('hepsiburada-listings.json')),
    );

    const result = await connector.fetchInventory(context);

    expect(result.nextCursor).toBeUndefined();
    expect(result.variants).toEqual([
      expect.objectContaining({
        externalProductId: 'HBCV00009U88OT',
        externalVariantId: 'HBCV00009U88OT-S',
        sku: 'F6265AX25SM-S',
        price: 210,
        currency: 'TRY',
        stock: 4,
      }),
      expect.objectContaining({
        externalProductId: 'HBCV00009U88OT',
        externalVariantId: 'HBCV00009U88OT-M',
        sku: 'F6265AX25SM-M',
        price: 219.9,
        stock: 2,
      }),
    ]);
  });

  it('fetches open questions and preserves product SKU matching keys', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:00:00.000Z'));
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('hepsiburada-questions.json')),
    );

    const result = await connector.fetchProductQuestions(context, {
      createdAfter: new Date('2026-09-04T08:00:00.000Z'),
    });
    const url = new URL(requestUrl(fetchSpy));

    expect(url.origin + url.pathname).toBe(
      'https://api-asktoseller-merchant-sit.hepsiburada.com/api/v1.0/issues',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: 'Open',
      minCreatedAt: '2026-09-04T08:00:00.000Z',
      maxCreatedAt: '2026-09-04T09:00:00.000Z',
      page: '0',
      size: '50',
    });
    expect(requestHeaders(fetchSpy)).toMatchObject({
      merchantId: 'merchant-123',
    });
    expect(result.nextCursor).toBeUndefined();
    expect(result.questions).toEqual([
      expect.objectContaining({
        externalId: 'HB-Q-1001',
        externalProductId: 'F6265AX25SM-M',
        externalCustomerId: 'HB-C-1',
        customerName: 'Ayşe K.',
        text: 'M beden stokta mı?',
        createdAt: new Date('2026-09-04T08:30:00.000Z'),
      }),
      expect.objectContaining({
        externalId: 'HB-Q-1002',
        externalProductId: 'HBCV00009U88OT-S',
        customerName: undefined,
      }),
    ]);
  });

  it('posts a trimmed answer and accepts an acknowledgement without answer id', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:00:00.000Z'));
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(readFixture('hepsiburada-question-answer.json'), 201),
    );

    const result = await connector.sendProductQuestionAnswer(
      context,
      'HB-Q-1001',
      '  Merhabalar, M beden stoklarımızda mevcuttur.  ',
    );
    const [, request] = fetchSpy.mock.calls[0];

    expect(requestUrl(fetchSpy)).toBe(
      'https://api-asktoseller-merchant-sit.hepsiburada.com/api/v1.0/issues/HB-Q-1001/answer',
    );
    expect(request).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        answer: 'Merhabalar, M beden stoklarımızda mevcuttur.',
      }),
    });
    expect(result).toEqual({
      externalAnswerId: undefined,
      answeredAt: new Date('2026-09-04T09:00:00.000Z'),
    });
  });

  it('rejects empty and oversized answers before sending', async () => {
    await expect(
      connector.sendProductQuestionAnswer(context, 'HB-Q-1001', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      connector.sendProductQuestionAnswer(
        context,
        'HB-Q-1001',
        'x'.repeat(2001),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces provider status and response body for failed requests', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('{"message":"Too many requests"}', { status: 429 }),
    );

    await expect(connector.fetchProducts(context)).rejects.toThrow(
      'Provider request failed with status 429: {"message":"Too many requests"}',
    );
  });
});

function readFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', 'contracts', name), 'utf8'),
  ) as unknown;
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
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
