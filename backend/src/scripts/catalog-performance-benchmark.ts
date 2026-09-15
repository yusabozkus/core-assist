import 'dotenv/config';
import { Pool, type QueryResultRow } from 'pg';

const BENCHMARK_BRAND = 'Core Asistan Benchmark';
const BENCHMARK_MARKER = '[CORE_ASISTAN_CATALOG_BENCHMARK_V1]';
const MOCK_BENCHMARK_DESCRIPTION =
  'Yüksek hacimli katalog ve stok senkronizasyonu testi için oluşturulmuş mock ürün.';
const DEFAULT_PRODUCT_COUNT = 10_000;
const MAX_PRODUCT_COUNT = 50_000;
const EXPLAIN_SAMPLE_COUNT = 5;
const LOW_STOCK_THRESHOLD = 5;

type Action = 'seed' | 'explain' | 'clean';

type Options = {
  action: Action;
  storeId?: string;
  productCount: number;
};

type StoreRow = QueryResultRow & {
  id: string;
  name: string;
  products: number;
  variants: number;
  benchmarkProducts: number;
};

type ConnectionRow = QueryResultRow & {
  id: string;
  providerKey: string;
};

type ExplainRow = QueryResultRow & {
  'QUERY PLAN': Array<{
    Plan: Record<string, unknown>;
    'Planning Time': number;
    'Execution Time': number;
  }>;
};

type ExplainMeasurement = {
  executionMs: number;
  planningMs: number;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  plan: string;
};

type SqlQuery = {
  name: string;
  text: string;
  values: unknown[];
};

async function run() {
  assertSafeEnvironment();
  const options = parseOptions(process.argv.slice(2));
  const pool = new Pool({ connectionString: requiredDatabaseUrl() });

  try {
    const store = await selectStore(pool, options.storeId);
    console.log(
      `\nHedef mağaza: ${store.name} (${store.id})\n` +
        `Mevcut veri: ${formatNumber(store.products)} ürün, ${formatNumber(store.variants)} varyant`,
    );

    switch (options.action) {
      case 'seed':
        await seedCatalog(pool, store, options.productCount);
        break;
      case 'explain':
        await explainCatalog(pool, store);
        break;
      case 'clean':
        await cleanCatalog(pool, store);
        break;
    }
  } finally {
    await pool.end();
  }
}

async function seedCatalog(pool: Pool, store: StoreRow, productCount: number) {
  if (store.benchmarkProducts > 0) {
    throw new Error(
      `${formatNumber(store.benchmarkProducts)} benchmark ürünü zaten mevcut. ` +
        'Tekrar veri eklemeden önce npm run benchmark:catalog:clean komutunu çalıştırın.',
    );
  }

  const connection = await selectConnection(pool, store.id);
  const sampleImage = await pool.query<{ url: string }>(`
    SELECT url
    FROM product_image
    ORDER BY "createdAt" ASC
    LIMIT 1
  `);
  const imageUrl = sampleImage.rows[0]?.url ?? null;
  const startedAt = performance.now();

  await pool.query('BEGIN');
  try {
    const result = await pool.query<{
      products: number;
      variants: number;
      externalProducts: number;
      externalVariants: number;
      images: number;
    }>(
      `
        WITH inserted_products AS (
          INSERT INTO product (
            id, "storeId", title, description, brand, category,
            status, "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid()::text,
            $1,
            'Benchmark Ürünü ' || lpad(series::text, 5, '0'),
            $2,
            $3,
            (ARRAY['Tişört', 'Gömlek', 'Pantolon', 'Elbise', 'Ayakkabı'])[1 + ((series - 1) % 5)],
            'ACTIVE',
            now() - (((series - 1) % 365) * interval '1 day'),
            now() - (((series - 1) % 90) * interval '1 minute')
          FROM generate_series(1, $4::int) AS series
          RETURNING id
        ), numbered_products AS (
          SELECT id, row_number() OVER (ORDER BY id) AS product_number
          FROM inserted_products
        ), inserted_variants AS (
          INSERT INTO product_variant (
            id, "productId", title, sku, barcode, color, size, price,
            currency, stock, status, "sourceUpdatedAt", "lastSyncedAt",
            "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid()::text,
            product.id,
            size.label,
            'BENCH-' || replace(product.id, '-', '') || '-' || size.position,
            '99' || lpad(product.product_number::text, 10, '0') || size.position,
            (ARRAY['Siyah', 'Beyaz', 'Lacivert', 'Bej'])[size.position],
            size.label,
            (299 + ((product.product_number + size.position) % 2_700))::numeric(12, 2),
            'TRY',
            CASE
              WHEN distribution.bucket < 8 THEN 0
              WHEN distribution.bucket < 13 THEN 0
              WHEN distribution.bucket < 25 THEN 1 + (distribution.bucket % 5)
              ELSE 6 + (distribution.bucket % 95)
            END,
            CASE
              WHEN distribution.bucket < 8 THEN 'OUT_OF_STOCK'::"ProductVariantStatus"
              WHEN distribution.bucket < 13 THEN 'UNAVAILABLE'::"ProductVariantStatus"
              ELSE 'ACTIVE'::"ProductVariantStatus"
            END,
            sync_state.synced_at,
            sync_state.synced_at,
            now() - (((product.product_number + size.position) % 365) * interval '1 day'),
            now() - (((product.product_number + size.position) % 90) * interval '1 minute')
          FROM numbered_products product
          CROSS JOIN (VALUES (1, 'S'), (2, 'M'), (3, 'L'), (4, 'XL')) AS size(position, label)
          CROSS JOIN LATERAL (
            SELECT abs(hashtext(product.id || ':' || size.position::text)) % 100 AS bucket
          ) distribution
          CROSS JOIN LATERAL (
            SELECT CASE
              WHEN abs(hashtext('sync:' || product.id || ':' || size.position::text)) % 20 = 0
                THEN NULL
              WHEN abs(hashtext('sync:' || product.id || ':' || size.position::text)) % 10 = 0
                THEN now() - interval '2 days'
              ELSE now() - (
                (abs(hashtext('sync:' || product.id || ':' || size.position::text)) % 10)
                * interval '1 minute'
              )
            END AS synced_at
          ) sync_state
          RETURNING id, "productId", sku, barcode, "sourceUpdatedAt", "lastSyncedAt"
        ), inserted_external_products AS (
          INSERT INTO external_product (
            id, "connectionId", "productId", "externalId", "externalUrl",
            status, "sourceUpdatedAt", "lastSyncedAt", "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid()::text,
            $5,
            product.id,
            'benchmark-product-' || replace(product.id, '-', ''),
            'https://example.com/benchmark/' || product.id,
            'ACTIVE',
            now(),
            now(),
            now(),
            now()
          FROM numbered_products product
          WHERE $5::text IS NOT NULL
          RETURNING id, "productId"
        ), inserted_external_variants AS (
          INSERT INTO external_product_variant (
            id, "externalProductId", "productVariantId", "externalId", sku,
            barcode, status, "sourceUpdatedAt", "lastSyncedAt", "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid()::text,
            external_product.id,
            variant.id,
            'benchmark-variant-' || replace(variant.id, '-', ''),
            variant.sku,
            variant.barcode,
            'ACTIVE',
            variant."sourceUpdatedAt",
            COALESCE(variant."lastSyncedAt", now()),
            now(),
            now()
          FROM inserted_variants variant
          JOIN inserted_external_products external_product
            ON external_product."productId" = variant."productId"
          RETURNING id
        ), inserted_images AS (
          INSERT INTO product_image (id, "productId", url, position, "createdAt")
          SELECT gen_random_uuid()::text, product.id, $6, 0, now()
          FROM numbered_products product
          WHERE $6::text IS NOT NULL
          RETURNING id
        )
        SELECT
          (SELECT COUNT(*)::int FROM inserted_products) AS products,
          (SELECT COUNT(*)::int FROM inserted_variants) AS variants,
          (SELECT COUNT(*)::int FROM inserted_external_products) AS "externalProducts",
          (SELECT COUNT(*)::int FROM inserted_external_variants) AS "externalVariants",
          (SELECT COUNT(*)::int FROM inserted_images) AS images
      `,
      [
        store.id,
        BENCHMARK_MARKER,
        BENCHMARK_BRAND,
        productCount,
        connection?.id ?? null,
        imageUrl,
      ],
    );
    await pool.query('COMMIT');

    const inserted = result.rows[0];
    console.log(
      `\nBenchmark verisi ${formatDuration(performance.now() - startedAt)} içinde eklendi:`,
    );
    console.log(`- ${formatNumber(inserted.products)} ürün`);
    console.log(`- ${formatNumber(inserted.variants)} varyant`);
    console.log(
      `- ${formatNumber(inserted.externalProducts)} pazaryeri ürünü (${connection?.providerKey ?? 'bağlantı bulunamadı'})`,
    );
    console.log(
      `- ${formatNumber(inserted.externalVariants)} pazaryeri varyantı`,
    );
    console.log(`- ${formatNumber(inserted.images)} ürün görseli`);
    console.log(
      '\nArayüzü yenileyerek Ürünler ve Stok Yönetimi sayfalarını bu veri hacmiyle kontrol edebilirsiniz.',
    );
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function explainCatalog(pool: Pool, store: StoreRow) {
  if (store.benchmarkProducts === 0) {
    throw new Error(
      'Benchmark ürünü bulunamadı. Önce npm run benchmark:catalog:seed komutunu çalıştırın.',
    );
  }

  console.log('\nPostgreSQL istatistikleri güncelleniyor...');
  await pool.query('ANALYZE product');
  await pool.query('ANALYZE product_variant');

  const commonValues = [store.id, LOW_STOCK_THRESHOLD];
  const currentSummary: SqlQuery = {
    name: 'Yeni tek aggregate stok özeti',
    text: `
      SELECT
        COUNT(*)::int AS variants,
        COUNT(*) FILTER (
          WHERE v.status = 'ACTIVE' AND v.stock > $2
        )::int AS healthy,
        COUNT(*) FILTER (
          WHERE v.status = 'ACTIVE' AND v.stock > 0 AND v.stock <= $2
        )::int AS "lowStock",
        COUNT(*) FILTER (
          WHERE v.status = 'OUT_OF_STOCK'
            OR (v.status = 'ACTIVE' AND v.stock <= 0)
        )::int AS "outOfStock",
        COUNT(*) FILTER (WHERE v.status = 'UNAVAILABLE')::int AS unavailable,
        COUNT(*) FILTER (
          WHERE v."lastSyncedAt" IS NULL
            OR v."lastSyncedAt" < now() - interval '15 minutes'
        )::int AS stale,
        COALESCE(
          SUM(v.stock) FILTER (WHERE v.status = 'ACTIVE'), 0
        )::float8 AS "totalStock",
        MAX(v."lastSyncedAt") AS "lastSyncedAt"
      FROM product_variant v
      JOIN product p ON p.id = v."productId"
      WHERE p."storeId" = $1
        AND p.status = 'ACTIVE'
        AND v.status <> 'ARCHIVED'
    `,
    values: commonValues,
  };
  const legacySummaries = legacySummaryQueries(store.id);

  console.log(
    `\n${EXPLAIN_SAMPLE_COUNT} sıcak çalıştırmanın medyanı ölçülüyor...`,
  );
  const current = await measureQuery(pool, currentSummary);
  const legacy = await Promise.all(
    legacySummaries.map((query) => measureQuery(pool, query)),
  );
  const legacyTotal = legacy.reduce(
    (total, measurement) => ({
      executionMs: total.executionMs + measurement.executionMs,
      planningMs: total.planningMs + measurement.planningMs,
      sharedHitBlocks: total.sharedHitBlocks + measurement.sharedHitBlocks,
      sharedReadBlocks: total.sharedReadBlocks + measurement.sharedReadBlocks,
      plan: '8 sorgu',
    }),
    emptyMeasurement(),
  );

  console.log('\nStok özeti karşılaştırması');
  printMeasurement('Eski 8 ayrı sorgu (toplam)', legacyTotal);
  printMeasurement(currentSummary.name, current);
  console.log(
    `- Süre farkı: ${ratio(legacyTotal.executionMs, current.executionMs)}`,
  );
  console.log(
    `- Buffer farkı: ${ratio(
      legacyTotal.sharedHitBlocks + legacyTotal.sharedReadBlocks,
      current.sharedHitBlocks + current.sharedReadBlocks,
    )}`,
  );

  const pages = [
    {
      name: 'Ürünler ilk sayfa',
      text: `
        SELECT p.id, p.title, p.brand, p.category, p."updatedAt"
        FROM product p
        WHERE p."storeId" = $1 AND p.status = 'ACTIVE'
        ORDER BY p."updatedAt" DESC, p.id DESC
        LIMIT 21
      `,
      values: [store.id],
    },
    {
      name: 'Stok yönetimi ilk sayfa',
      text: `
        SELECT p.id, p.title
        FROM product p
        WHERE p."storeId" = $1
          AND p.status = 'ACTIVE'
          AND EXISTS (
            SELECT 1 FROM product_variant v
            WHERE v."productId" = p.id AND v.status <> 'ARCHIVED'
          )
        ORDER BY p.title ASC, p.id ASC
        LIMIT 21
      `,
      values: [store.id],
    },
  ] satisfies SqlQuery[];

  console.log('\nSayfa sorguları');
  for (const query of pages) {
    printMeasurement(query.name, await measureQuery(pool, query));
  }

  console.log(
    '\nNot: Aggregate sorgusunda çok sayıda varyant özetlendiği için Seq Scan seçilmesi normal olabilir; önemli olan tablonun sekiz yerine bir kez taranmasıdır.',
  );
}

async function cleanCatalog(pool: Pool, store: StoreRow) {
  if (store.benchmarkProducts === 0) {
    console.log('\nTemizlenecek benchmark ürünü bulunamadı.');
    return;
  }

  const startedAt = performance.now();
  const result = await pool.query(
    `
      DELETE FROM product
      WHERE "storeId" = $1
        AND brand = $2
        AND description IN ($3, $4)
    `,
    [store.id, BENCHMARK_BRAND, BENCHMARK_MARKER, MOCK_BENCHMARK_DESCRIPTION],
  );

  console.log(
    `\n${formatNumber(result.rowCount ?? 0)} benchmark ürünü ve ilişkili kayıtları ` +
      `${formatDuration(performance.now() - startedAt)} içinde silindi.`,
  );
  console.log('Mevcut seed ürünleri korunmuştur.');
}

async function selectStore(pool: Pool, storeId?: string) {
  const result = await pool.query<StoreRow>(
    `
      SELECT
        s.id,
        s.name,
        COUNT(DISTINCT p.id)::int AS products,
        COUNT(DISTINCT v.id)::int AS variants,
        COUNT(DISTINCT p.id) FILTER (
          WHERE p.brand = $2 AND p.description IN ($3, $4)
        )::int AS "benchmarkProducts"
      FROM store s
      LEFT JOIN product p ON p."storeId" = s.id
      LEFT JOIN product_variant v ON v."productId" = p.id
      WHERE s.status = 'ACTIVE' AND ($1::text IS NULL OR s.id = $1)
      GROUP BY s.id, s.name, s."createdAt"
      ORDER BY s."createdAt" ASC
    `,
    [
      storeId ?? null,
      BENCHMARK_BRAND,
      BENCHMARK_MARKER,
      MOCK_BENCHMARK_DESCRIPTION,
    ],
  );

  if (result.rows.length === 0) {
    throw new Error('Uygun aktif mağaza bulunamadı.');
  }
  if (!storeId && result.rows.length > 1) {
    const choices = result.rows
      .map((store) => `- ${store.name}: --store-id=${store.id}`)
      .join('\n');
    throw new Error(
      `Birden fazla aktif mağaza bulundu. Hedef mağazayı seçin:\n${choices}`,
    );
  }

  return result.rows[0];
}

async function selectConnection(pool: Pool, storeId: string) {
  const result = await pool.query<ConnectionRow>(
    `
      SELECT id, provider AS "providerKey"
      FROM channel_connection
      WHERE "storeId" = $1
        AND status = 'CONNECTED'
        AND "removedAt" IS NULL
      ORDER BY "createdAt" ASC
      LIMIT 1
    `,
    [storeId],
  );
  return result.rows[0] ?? null;
}

function legacySummaryQueries(storeId: string): SqlQuery[] {
  const baseJoin = `
    FROM product_variant v
    JOIN product p ON p.id = v."productId"
    WHERE p."storeId" = $1
      AND p.status = 'ACTIVE'
      AND v.status <> 'ARCHIVED'
  `;

  return [
    ['Toplam varyant', `SELECT COUNT(*) ${baseJoin}`, [storeId]],
    [
      'Sağlıklı stok',
      `SELECT COUNT(*) ${baseJoin} AND v.status = 'ACTIVE' AND v.stock > $2`,
      [storeId, LOW_STOCK_THRESHOLD],
    ],
    [
      'Düşük stok',
      `SELECT COUNT(*) ${baseJoin} AND v.status = 'ACTIVE' AND v.stock > 0 AND v.stock <= $2`,
      [storeId, LOW_STOCK_THRESHOLD],
    ],
    [
      'Tükenen stok',
      `SELECT COUNT(*) ${baseJoin} AND (v.status = 'OUT_OF_STOCK' OR (v.status = 'ACTIVE' AND v.stock <= 0))`,
      [storeId],
    ],
    [
      'Kullanılamayan',
      `SELECT COUNT(*) ${baseJoin} AND v.status = 'UNAVAILABLE'`,
      [storeId],
    ],
    [
      'Güncelliğini yitiren',
      `SELECT COUNT(*) ${baseJoin} AND (v."lastSyncedAt" IS NULL OR v."lastSyncedAt" < now() - interval '15 minutes')`,
      [storeId],
    ],
    [
      'Toplam stok',
      `SELECT COALESCE(SUM(v.stock), 0) ${baseJoin} AND v.status = 'ACTIVE'`,
      [storeId],
    ],
    [
      'Son senkronizasyon',
      `SELECT MAX(v."lastSyncedAt") ${baseJoin}`,
      [storeId],
    ],
  ].map(([name, text, values]) => ({
    name: name as string,
    text: text as string,
    values: values as unknown[],
  }));
}

async function measureQuery(pool: Pool, query: SqlQuery) {
  const samples: ExplainMeasurement[] = [];
  await explain(pool, query);

  for (let index = 0; index < EXPLAIN_SAMPLE_COUNT; index += 1) {
    samples.push(await explain(pool, query));
  }

  return {
    executionMs: median(samples.map((sample) => sample.executionMs)),
    planningMs: median(samples.map((sample) => sample.planningMs)),
    sharedHitBlocks: median(samples.map((sample) => sample.sharedHitBlocks)),
    sharedReadBlocks: median(samples.map((sample) => sample.sharedReadBlocks)),
    plan: samples.at(-1)?.plan ?? 'Bilinmiyor',
  };
}

async function explain(pool: Pool, query: SqlQuery) {
  const result = await pool.query<ExplainRow>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`,
    query.values,
  );
  const root = result.rows[0]?.['QUERY PLAN']?.[0];
  if (!root) throw new Error(`${query.name} için EXPLAIN sonucu alınamadı.`);

  return {
    executionMs: root['Execution Time'],
    planningMs: root['Planning Time'],
    sharedHitBlocks: numberField(root.Plan, 'Shared Hit Blocks'),
    sharedReadBlocks: numberField(root.Plan, 'Shared Read Blocks'),
    plan: collectPlanNodes(root.Plan).join(' → '),
  };
}

function collectPlanNodes(plan: Record<string, unknown>): string[] {
  const node = typeof plan['Node Type'] === 'string' ? plan['Node Type'] : null;
  const children = Array.isArray(plan.Plans)
    ? plan.Plans.flatMap((child) =>
        child && typeof child === 'object'
          ? collectPlanNodes(child as Record<string, unknown>)
          : [],
      )
    : [];
  return node ? [node, ...children] : children;
}

function numberField(value: Record<string, unknown>, key: string) {
  return typeof value[key] === 'number' ? value[key] : 0;
}

function emptyMeasurement(): ExplainMeasurement {
  return {
    executionMs: 0,
    planningMs: 0,
    sharedHitBlocks: 0,
    sharedReadBlocks: 0,
    plan: '',
  };
}

function printMeasurement(name: string, measurement: ExplainMeasurement) {
  console.log(`\n${name}`);
  console.log(`- Execution: ${measurement.executionMs.toFixed(3)} ms`);
  console.log(`- Planning: ${measurement.planningMs.toFixed(3)} ms`);
  console.log(
    `- Buffers: ${formatNumber(measurement.sharedHitBlocks)} hit / ` +
      `${formatNumber(measurement.sharedReadBlocks)} read`,
  );
  console.log(`- Plan: ${measurement.plan}`);
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function ratio(before: number, after: number) {
  if (after <= 0) return 'ölçülemedi';
  return `${(before / after).toFixed(2)}x daha az`;
}

function parseOptions(args: string[]): Options {
  if (args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  const action = args[0];
  if (action !== 'seed' && action !== 'explain' && action !== 'clean') {
    printHelp();
    throw new Error('seed, explain veya clean işlemlerinden birini seçin.');
  }

  const rawProductCount = optionValue(args, 'products');
  const productCount = rawProductCount
    ? Number(rawProductCount)
    : DEFAULT_PRODUCT_COUNT;
  if (
    !Number.isInteger(productCount) ||
    productCount < 1 ||
    productCount > MAX_PRODUCT_COUNT
  ) {
    throw new Error(
      `--products değeri 1 ile ${formatNumber(MAX_PRODUCT_COUNT)} arasında olmalı.`,
    );
  }

  return {
    action,
    storeId: optionValue(args, 'store-id'),
    productCount,
  };
}

function optionValue(args: string[], name: string) {
  const prefix = `--${name}=`;
  return args
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Benchmark komutları production ortamında çalıştırılamaz.');
  }

  const databaseUrl = new URL(requiredDatabaseUrl());
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error(
      'Benchmark yalnızca yerel PostgreSQL veritabanında çalıştırılabilir.',
    );
  }
}

function requiredDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL tanımlı değil.');
  return databaseUrl;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value);
}

function formatDuration(milliseconds: number) {
  return `${(milliseconds / 1_000).toFixed(2)} saniye`;
}

function printHelp() {
  console.log(`
Kullanım:
  npm run benchmark:catalog:seed
  npm run benchmark:catalog:explain
  npm run benchmark:catalog:clean

Seçenekler:
  --store-id=<uuid>  Birden fazla mağaza varsa hedef mağazayı seçer.
  --products=<adet>  Eklenecek ürün sayısı (varsayılan: 10.000).
`);
}

void run().catch((error: unknown) => {
  console.error(
    `\nBenchmark başarısız: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
