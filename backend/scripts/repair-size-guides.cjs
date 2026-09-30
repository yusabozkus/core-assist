// Read-only by default. Explicit product IDs prevent broad changes across stores.
// node --require ./scripts/register-email-tests.cjs scripts/repair-size-guides.cjs --product-id=<uuid> [--apply]
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { writeFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
  GeminiClientService,
} = require('../src/modules/ai/gemini-client.service');
const {
  SizeGuideImageService,
} = require('../src/modules/size-guides/size-guide-image.service');
const {
  createExtractionPrompt,
} = require('../src/modules/size-guides/size-guide-worker.service');
const {
  formatNormalizedSizeGuide,
} = require('../src/modules/size-guides/size-guide-queue.service');
const {
  getSizeGuideScope,
  isSizeGuideCompatible,
  SIZE_GUIDE_EXTRACTION_VERSION,
} = require('../src/modules/size-guides/size-guide-scope');
const {
  separateIndependentLengthTable,
} = require('../src/modules/size-guides/size-guide-normalization');

async function main() {
  const productIds = process.argv
    .filter((arg) => arg.startsWith('--product-id='))
    .map((arg) => arg.slice(13));
  if (
    !productIds.length ||
    productIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))
  )
    throw new Error('Provide explicit --product-id=<uuid> arguments.');
  const apply = process.argv.includes('--apply');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const { rows } = await db.query(
      `SELECT g.*, p.title, p.category,
      COALESCE((SELECT json_agg(json_build_object('name', a.name, 'value', a.value)) FROM product_attribute a WHERE a."productId"=p.id), '[]') AS attributes
      FROM product_size_guide g JOIN product p ON p.id=g."productId"
      WHERE p.id = ANY($1::text[]) AND g.status='READY'`,
      [productIds],
    );
    const plans = [];
    const cache = new Map();
    for (const row of rows) {
      const scope = getSizeGuideScope(row);
      if (scope.audience === 'UNKNOWN')
        throw new Error(`Unknown target audience for ${row.productId}`);
      if (
        row.structuredData?.extractionContext === scope.key &&
        isSizeGuideCompatible(row, row.structuredData)
      )
        continue;
      const key = `${row.sourceUrl}:${scope.key}`;
      let extraction = cache.get(key);
      if (!extraction) {
        const image = await new SizeGuideImageService().download(row.sourceUrl);
        extraction = separateIndependentLengthTable(
          await new GeminiClientService().extractSizeGuide({
            model:
              process.env.GEMINI_SIZE_GUIDE_MODEL ||
              process.env.GEMINI_MODEL ||
              'gemini-3.5-flash-lite',
            imageBase64: image.bytes.toString('base64'),
            mimeType: image.mimeType,
            prompt: createExtractionPrompt(row),
          }),
        );
        if (
          !isSizeGuideCompatible(row, extraction) ||
          extraction.audience !== scope.audience ||
          extraction.confidence < 0.9
        )
          throw new Error(`Unverified extraction for ${row.id}`);
        cache.set(key, extraction);
      }
      plans.push({
        row,
        extraction: {
          ...extraction,
          extractionVersion: SIZE_GUIDE_EXTRACTION_VERSION,
          extractionContext: scope.key,
        },
      });
    }
    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          guideCount: plans.length,
          uniqueExtractions: cache.size,
          guides: plans.map(({ row, extraction }) => ({
            id: row.id,
            productId: row.productId,
            previousTitle: row.structuredData?.title,
            title: extraction.title,
            scope: extraction.extractionContext,
            confidence: extraction.confidence,
            rowCount: extraction.rows.length,
            xl: extraction.rows.find((item) => item.label.includes('XL')),
            size36: extraction.rows.find((item) => item.label === '36'),
            notes: extraction.notes,
          })),
        },
        null,
        2,
      ),
    );
    if (!apply || !plans.length) return;
    const backup = join(
      mkdtempSync(join(tmpdir(), 'size-guide-backup-')),
      'guides.json',
    );
    writeFileSync(
      backup,
      JSON.stringify(
        plans.map(({ row }) => row),
        null,
        2,
      ),
    );
    await db.query('BEGIN');
    try {
      for (const { row, extraction } of plans) {
        const result = await db.query(
          `UPDATE product_size_guide SET "rawText"=$1, "normalizedText"=$2,
          "structuredData"=$3::jsonb, confidence=$4, "failureReason"=NULL, "analyzedAt"=now(), "updatedAt"=now()
          WHERE id=$5 AND "sourceUrl"=$6 AND "structuredData" IS NOT DISTINCT FROM $7::jsonb AND status='READY'`,
          [
            extraction.rawText.slice(0, 20000),
            formatNormalizedSizeGuide(extraction),
            JSON.stringify(extraction),
            extraction.confidence,
            row.id,
            row.sourceUrl,
            JSON.stringify(row.structuredData),
          ],
        );
        if (result.rowCount !== 1)
          throw new Error(
            `Guide ${row.id} changed concurrently; rolling back.`,
          );
      }
      await db.query('COMMIT');
      console.log(JSON.stringify({ updated: plans.length, backup }));
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
