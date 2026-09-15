import 'dotenv/config';
import { Pool, type QueryResultRow } from 'pg';

const BENCHMARK_EVENT_PREFIX = 'core-asistan-benchmark-question-v1-';
const DEFAULT_QUESTION_COUNT = 10_000;
const MAX_QUESTION_COUNT = 100_000;
const EXPLAIN_SAMPLE_COUNT = 5;

type Action = 'seed' | 'explain' | 'clean';

type Options = {
  action: Action;
  storeId?: string;
  questionCount: number;
};

type StoreRow = QueryResultRow & {
  id: string;
  name: string;
  questions: number;
  benchmarkQuestions: number;
};

type ConnectionRow = QueryResultRow & {
  id: string;
  providerKey: string;
  products: number;
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
    console.log(`\nHedef mağaza: ${store.name} (${store.id})`);
    console.log(
      `Mevcut soru: ${formatNumber(store.questions)} · Benchmark: ${formatNumber(store.benchmarkQuestions)}`,
    );

    switch (options.action) {
      case 'seed':
        await seedQuestions(pool, store, options.questionCount);
        break;
      case 'explain':
        await explainQuestions(pool, store);
        break;
      case 'clean':
        await cleanQuestions(pool, store);
        break;
    }
  } finally {
    await pool.end();
  }
}

async function seedQuestions(
  pool: Pool,
  store: StoreRow,
  questionCount: number,
) {
  if (store.benchmarkQuestions > 0) {
    throw new Error(
      `${formatNumber(store.benchmarkQuestions)} benchmark sorusu zaten mevcut. ` +
        'Önce npm run benchmark:questions:clean komutunu çalıştırın.',
    );
  }

  const connection = await selectConnection(pool, store.id);
  const startedAt = performance.now();

  await pool.query('BEGIN');
  try {
    const result = await pool.query<{
      events: number;
      questions: number;
      drafts: number;
      answers: number;
    }>(
      `
        WITH source_products AS MATERIALIZED (
          SELECT
            ep.id AS external_product_record_id,
            ep."externalId" AS external_product_id,
            p.id AS product_id,
            p.title,
            image.url AS image_url,
            row_number() OVER (ORDER BY ep.id) AS product_number
          FROM external_product ep
          JOIN product p ON p.id = ep."productId"
          LEFT JOIN LATERAL (
            SELECT pi.url
            FROM product_image pi
            WHERE pi."productId" = p.id
            ORDER BY pi.position ASC, pi.id ASC
            LIMIT 1
          ) image ON true
          WHERE ep."connectionId" = $2
            AND ep.status = 'ACTIVE'
            AND p.status = 'ACTIVE'
        ), prepared AS MATERIALIZED (
          SELECT
            series,
            gen_random_uuid()::text AS event_id,
            gen_random_uuid()::text AS question_id,
            gen_random_uuid()::text AS attempt_id,
            product.external_product_record_id,
            product.external_product_id,
            product.product_id,
            product.title,
            product.image_url,
            now()
              - ((series - 1) % 90) * interval '1 day'
              - ((series * 13) % 1440) * interval '1 minute' AS occurred_at,
            CASE
              WHEN series % 10 = 0 THEN 'IGNORED'
              WHEN series % 10 BETWEEN 1 AND 4 THEN 'PENDING'
              WHEN series % 10 BETWEEN 5 AND 6 THEN 'DRAFTED'
              ELSE 'ANSWERED'
            END AS question_status,
            (ARRAY[
              'Bu ürünün kalıbı nasıldır?',
              'Kumaş ve materyal bilgisi nedir?',
              'Farklı renk seçenekleri var mı?',
              'İade veya değişim yapabilir miyim?',
              'Stok bilgisi güncel mi?'
            ])[1 + ((series - 1) % 5)] AS question_text,
            (ARRAY['FIT', 'MATERIAL', 'COLOR', 'RETURN', 'STOCK'])[
              1 + ((series - 1) % 5)
            ] AS requested_fact,
            0.60 + ((series * 7) % 40)::float8 / 100 AS confidence
          FROM generate_series(1, $3::int) series
          JOIN source_products product
            ON product.product_number = 1 + (
              (series - 1) % (SELECT COUNT(*) FROM source_products)
            )
        ), inserted_events AS (
          INSERT INTO incoming_event (
            id, "storeId", "connectionId", "externalEventId", "eventType",
            "externalCreatedAt", "receivedAt", "processingStatus", payload,
            "processedAt", "createdAt", "updatedAt"
          )
          SELECT
            event_id,
            $1,
            $2,
            $4 || lpad(series::text, 8, '0'),
            'PRODUCT_QUESTION'::"IncomingEventType",
            occurred_at,
            occurred_at,
            'PROCESSED'::"IncomingEventProcessingStatus",
            jsonb_build_object(
              'benchmark', true,
              'source', 'question-performance-benchmark',
              'sequence', series
            ),
            occurred_at,
            occurred_at,
            occurred_at
          FROM prepared
          RETURNING id
        ), inserted_questions AS (
          INSERT INTO product_question (
            id, "storeId", "connectionId", "incomingEventId", "productId",
            "externalProductRecordId", "externalQuestionId", "externalProductId",
            "externalCustomerId", "customerName", "productTitleSnapshot",
            "productImageUrlSnapshot", question, status, answer,
            "draftDecision", "draftConfidence", "draftAnswerability",
            "draftRisks", "draftMissingInformation", "draftEvidenceIds",
            "draftModel", "draftedAt", "externalCreatedAt", "answeredAt",
            "createdAt", "updatedAt"
          )
          SELECT
            question_id,
            $1,
            $2,
            event_id,
            product_id,
            external_product_record_id,
            $4 || lpad(series::text, 8, '0'),
            external_product_id,
            'benchmark-customer-' || ((series - 1) % 500 + 1),
            'Test Müşterisi ' || ((series - 1) % 500 + 1),
            title,
            image_url,
            question_text,
            question_status::"ProductQuestionStatus",
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED')
              THEN 'Merhaba, ürün bilgilerimize göre size yardımcı olabiliriz. Keyifli alışverişler dileriz.'
              ELSE NULL
            END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED')
              THEN (CASE WHEN confidence >= 0.85
                THEN 'READY_FOR_SEND'
                ELSE 'NEEDS_REVIEW'
              END)::"QuestionReplyDecision"
              ELSE NULL
            END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED') THEN confidence ELSE NULL END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED')
              THEN CASE WHEN confidence >= 0.85 THEN 'FULL' ELSE 'PARTIAL' END
              ELSE NULL
            END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED')
              THEN CASE WHEN confidence < 0.70 THEN '["LOW_CONFIDENCE"]'::jsonb ELSE '[]'::jsonb END
              ELSE NULL
            END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED')
              THEN CASE WHEN confidence < 0.75 THEN '["Ek ürün bilgisi"]'::jsonb ELSE '[]'::jsonb END
              ELSE NULL
            END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED')
              THEN '["product-details"]'::jsonb
              ELSE NULL
            END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED') THEN 'benchmark-fixture' ELSE NULL END,
            CASE WHEN question_status IN ('DRAFTED', 'ANSWERED') THEN occurred_at + interval '3 seconds' ELSE NULL END,
            occurred_at,
            CASE WHEN question_status = 'ANSWERED' THEN occurred_at + interval '2 minutes' ELSE NULL END,
            occurred_at,
            occurred_at
          FROM prepared
          JOIN inserted_events event ON event.id = prepared.event_id
          RETURNING id
        ), inserted_drafts AS (
          INSERT INTO ai_draft_attempt (
            id, "storeId", "questionId", trigger, outcome, answer, decision,
            confidence, answerability, risks, "missingInformation", "evidenceIds",
            model, interpretation, "requestedFacts", "detectedFacts",
            "automationMode", "autoSendEligible", "appliedConfidenceThreshold",
            "eligibilityReasons", "selectedAt", "finalizedAt", "createdAt"
          )
          SELECT
            attempt_id,
            $1,
            question_id,
            'AUTOMATION'::"AiDraftTrigger",
            CASE WHEN question_status = 'ANSWERED'
              THEN 'SENT'::"AiDraftOutcome"
              ELSE 'AVAILABLE'::"AiDraftOutcome"
            END,
            'Merhaba, ürün bilgilerimize göre size yardımcı olabiliriz. Keyifli alışverişler dileriz.',
            CASE WHEN confidence >= 0.85
              THEN 'READY_FOR_SEND'
              ELSE 'NEEDS_REVIEW'
            END::"QuestionReplyDecision",
            confidence,
            CASE WHEN confidence >= 0.85 THEN 'FULL' ELSE 'PARTIAL' END,
            CASE WHEN confidence < 0.70 THEN '["LOW_CONFIDENCE"]'::jsonb ELSE '[]'::jsonb END,
            CASE WHEN confidence < 0.75 THEN '["Ek ürün bilgisi"]'::jsonb ELSE '[]'::jsonb END,
            '["product-details"]'::jsonb,
            'benchmark-fixture',
            'Yüksek hacimli arayüz ve sorgu testi için üretilen kontrollü taslak.',
            jsonb_build_array(requested_fact),
            jsonb_build_array(requested_fact),
            'SHADOW'::"AiAutomationMode",
            confidence >= 0.85,
            0.85,
            '[]'::jsonb,
            CASE WHEN question_status = 'ANSWERED' THEN occurred_at + interval '90 seconds' ELSE NULL END,
            CASE WHEN question_status = 'ANSWERED' THEN occurred_at + interval '2 minutes' ELSE NULL END,
            occurred_at + interval '3 seconds'
          FROM prepared
          JOIN inserted_questions question ON question.id = prepared.question_id
          WHERE question_status IN ('DRAFTED', 'ANSWERED')
          RETURNING id
        ), inserted_answers AS (
          INSERT INTO question_answer (
            id, "storeId", "connectionId", "questionId", "draftAttemptId",
            origin, composition, answer, status, "externalAnswerId", attempts,
            "queuedAt", "processingStartedAt", "sentAt", "createdAt", "updatedAt"
          )
          SELECT
            gen_random_uuid()::text,
            $1,
            $2,
            question_id,
            attempt_id,
            'AUTOMATION'::"QuestionAnswerOrigin",
            'AI_UNCHANGED'::"QuestionAnswerComposition",
            'Merhaba, ürün bilgilerimize göre size yardımcı olabiliriz. Keyifli alışverişler dileriz.',
            'SENT'::"QuestionAnswerStatus",
            'benchmark-answer-' || lpad(series::text, 8, '0'),
            1,
            occurred_at + interval '90 seconds',
            occurred_at + interval '100 seconds',
            occurred_at + interval '2 minutes',
            occurred_at + interval '90 seconds',
            occurred_at + interval '2 minutes'
          FROM prepared
          JOIN inserted_drafts draft ON draft.id = prepared.attempt_id
          WHERE question_status = 'ANSWERED'
          RETURNING id
        )
        SELECT
          (SELECT COUNT(*)::int FROM inserted_events) AS events,
          (SELECT COUNT(*)::int FROM inserted_questions) AS questions,
          (SELECT COUNT(*)::int FROM inserted_drafts) AS drafts,
          (SELECT COUNT(*)::int FROM inserted_answers) AS answers
      `,
      [store.id, connection.id, questionCount, BENCHMARK_EVENT_PREFIX],
    );
    await pool.query('COMMIT');

    const inserted = result.rows[0];
    console.log(
      `\nBenchmark soruları ${formatDuration(performance.now() - startedAt)} içinde eklendi:`,
    );
    console.log(`- ${formatNumber(inserted.questions)} soru`);
    console.log(`- ${formatNumber(inserted.drafts)} AI taslağı`);
    console.log(`- ${formatNumber(inserted.answers)} gönderilmiş cevap`);
    console.log(
      '- Dağılım: %40 bekleyen, %20 taslak, %30 yanıtlanan, %10 yok sayılan.',
    );
    console.log(
      '\nBu veriler AI servisini ve kotayı tüketmez; Gelen Kutusu, Dashboard ve AI Performansı sayfalarında kullanılabilir.',
    );
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

async function explainQuestions(pool: Pool, store: StoreRow) {
  if (store.benchmarkQuestions === 0) {
    throw new Error(
      'Benchmark sorusu bulunamadı. Önce npm run benchmark:questions:seed komutunu çalıştırın.',
    );
  }

  console.log('\nPostgreSQL istatistikleri güncelleniyor...');
  await pool.query('ANALYZE product_question');
  await pool.query('ANALYZE ai_draft_attempt');
  await pool.query('ANALYZE question_answer');

  const queries: SqlQuery[] = [
    {
      name: 'Gelen Kutusu bekleyen ilk sayfa',
      text: `
        SELECT id, question, status, "externalCreatedAt"
        FROM product_question
        WHERE "storeId" = $1 AND status = 'PENDING'
        ORDER BY "externalCreatedAt" DESC, id DESC
        LIMIT 31
      `,
      values: [store.id],
    },
    {
      name: 'Gelen Kutusu durum sayaçları',
      text: `
        SELECT status, COUNT(*)::int
        FROM product_question
        WHERE "storeId" = $1
        GROUP BY status
      `,
      values: [store.id],
    },
    {
      name: 'Dashboard son 30 gün soru akışı',
      text: `
        SELECT date_trunc('day', "externalCreatedAt") AS day, COUNT(*)::int
        FROM product_question
        WHERE "storeId" = $1
          AND "externalCreatedAt" >= now() - interval '30 days'
        GROUP BY day
        ORDER BY day
      `,
      values: [store.id],
    },
    {
      name: 'AI Performansı son 30 gün taslakları',
      text: `
        SELECT outcome, COUNT(*)::int, AVG(confidence)
        FROM ai_draft_attempt
        WHERE "storeId" = $1
          AND "createdAt" >= now() - interval '30 days'
        GROUP BY outcome
      `,
      values: [store.id],
    },
    {
      name: 'Gönderilen cevaplar son 30 gün',
      text: `
        SELECT COUNT(*)::int
        FROM question_answer
        WHERE "storeId" = $1
          AND status = 'SENT'
          AND "sentAt" >= now() - interval '30 days'
      `,
      values: [store.id],
    },
  ];

  console.log(
    `\n${EXPLAIN_SAMPLE_COUNT} sıcak çalıştırmanın medyanı ölçülüyor...`,
  );
  for (const query of queries) {
    printMeasurement(query.name, await measureQuery(pool, query));
  }
}

async function cleanQuestions(pool: Pool, store: StoreRow) {
  if (store.benchmarkQuestions === 0) {
    console.log('\nTemizlenecek benchmark sorusu bulunamadı.');
    return;
  }

  const startedAt = performance.now();
  const result = await pool.query(
    `
      DELETE FROM incoming_event
      WHERE "storeId" = $1 AND "externalEventId" LIKE $2
    `,
    [store.id, `${BENCHMARK_EVENT_PREFIX}%`],
  );

  console.log(
    `\n${formatNumber(result.rowCount ?? 0)} benchmark sorusu ve ilişkili kayıtları ` +
      `${formatDuration(performance.now() - startedAt)} içinde silindi.`,
  );
  console.log('Mevcut seed ve senkronize sorular korunmuştur.');
}

async function selectStore(pool: Pool, storeId?: string) {
  const result = await pool.query<StoreRow>(
    `
      SELECT
        s.id,
        s.name,
        COUNT(DISTINCT q.id)::int AS questions,
        COUNT(DISTINCT q.id) FILTER (
          WHERE event."externalEventId" LIKE $2
        )::int AS "benchmarkQuestions"
      FROM store s
      LEFT JOIN product_question q ON q."storeId" = s.id
      LEFT JOIN incoming_event event ON event.id = q."incomingEventId"
      WHERE s.status = 'ACTIVE' AND ($1::text IS NULL OR s.id = $1)
      GROUP BY s.id, s.name, s."createdAt"
      ORDER BY s."createdAt" ASC
    `,
    [storeId ?? null, `${BENCHMARK_EVENT_PREFIX}%`],
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
      SELECT
        connection.id,
        connection.provider AS "providerKey",
        COUNT(external_product.id)::int AS products
      FROM channel_connection connection
      JOIN external_product
        ON external_product."connectionId" = connection.id
        AND external_product.status = 'ACTIVE'
      JOIN product
        ON product.id = external_product."productId"
        AND product.status = 'ACTIVE'
      WHERE connection."storeId" = $1
        AND connection.status = 'CONNECTED'
        AND connection."removedAt" IS NULL
      GROUP BY connection.id, connection.provider, connection."createdAt"
      ORDER BY connection."createdAt" ASC
      LIMIT 1
    `,
    [storeId],
  );

  const connection = result.rows[0];
  if (!connection) {
    throw new Error(
      'Aktif ürünü bulunan bağlı kanal yok. Önce katalog senkronizasyonunu çalıştırın.',
    );
  }

  console.log(
    `Kanal: ${connection.providerKey} · Kaynak ürün: ${formatNumber(connection.products)}`,
  );
  return connection;
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

  const rawQuestionCount = optionValue(args, 'questions');
  const questionCount = rawQuestionCount
    ? Number(rawQuestionCount)
    : DEFAULT_QUESTION_COUNT;
  if (
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > MAX_QUESTION_COUNT
  ) {
    throw new Error(
      `--questions değeri 1 ile ${formatNumber(MAX_QUESTION_COUNT)} arasında olmalı.`,
    );
  }

  return {
    action,
    storeId: optionValue(args, 'store-id'),
    questionCount,
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
  npm run benchmark:questions:seed
  npm run benchmark:questions:explain
  npm run benchmark:questions:clean

Seçenekler:
  --store-id=<uuid>    Birden fazla mağaza varsa hedef mağazayı seçer.
  --questions=<adet>   Eklenecek soru sayısı (varsayılan: 10.000).
`);
}

void run().catch((error: unknown) => {
  console.error(
    `\nBenchmark başarısız: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
