import { Prisma } from '../../generated/prisma/client';
import { AiPerformanceRange } from './dto/ai-performance-query.dto';

export function performanceBoundsSql(
  now: Date,
  timezone: string,
  range: AiPerformanceRange,
) {
  const days =
    range === AiPerformanceRange.SEVEN_DAYS
      ? 7
      : range === AiPerformanceRange.NINETY_DAYS
        ? 90
        : 30;
  return Prisma.sql`
    WITH local_bounds AS (
      SELECT ${now}::timestamptz AT TIME ZONE ${timezone} AS local_now,
        ${days}::int AS span_days
    ), starts AS (
      SELECT *, (local_now::date - (span_days - 1))::timestamp AS local_from
      FROM local_bounds
    )
    SELECT (local_from AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC' AS "from",
      ((local_from - make_interval(days => span_days)) AT TIME ZONE ${timezone})
        AT TIME ZONE 'UTC' AS "previousFrom",
      ((local_now - make_interval(days => span_days)) AT TIME ZONE ${timezone})
        AT TIME ZONE 'UTC' AS "previousTo"
    FROM starts
  `;
}

export function performanceSourceSql({
  storeId,
  from,
  now,
  provider,
}: {
  storeId: string;
  from: Date | null;
  now: Date;
  provider: string | null;
}) {
  const providerFilter = provider
    ? Prisma.sql`AND c.provider = ${provider}`
    : Prisma.empty;
  const attemptTime = from
    ? Prisma.sql`AND a."createdAt" >= ${from}`
    : Prisma.empty;
  const sentTime = from ? Prisma.sql`AND d."sentAt" >= ${from}` : Prisma.empty;
  const queuedTime = from
    ? Prisma.sql`AND d."queuedAt" >= ${from}`
    : Prisma.empty;
  return Prisma.sql`
    WITH attempts AS (
      SELECT a.id, a."questionId", a.decision, a.confidence, a.answerability,
        a."requestedFacts", a."automationMode", a."autoSendEligible",
        a."eligibilityReasons", a.risks, a."missingInformation", a."createdAt",
        c.provider AS "providerKey"
      FROM ai_draft_attempt a
      JOIN product_question q ON q.id = a."questionId" AND q."storeId" = ${storeId}
      JOIN channel_connection c ON c.id = q."connectionId" AND c."storeId" = ${storeId}
      WHERE a."storeId" = ${storeId} AND a."createdAt" <= ${now} ${attemptTime} ${providerFilter}
    ), deliveries AS (
      SELECT d.id, d."questionId", d."draftAttemptId", d.origin, d.composition, d.status,
        d."sentAt", d."queuedAt", c.provider AS "providerKey"
      FROM question_answer d
      JOIN channel_connection c ON c.id = d."connectionId" AND c."storeId" = ${storeId}
      WHERE d."storeId" = ${storeId} ${providerFilter} AND (
        (d.status = 'SENT' AND d."sentAt" <= ${now} ${sentTime})
        OR (d.status IN ('FAILED', 'QUEUED', 'PROCESSING') AND d."queuedAt" <= ${now} ${queuedTime})
      )
    )
  `;
}

// Both the chart and its detail list use the same reason fallback rules.
export function reviewReasonRowsSql() {
  return Prisma.sql`
    review AS (
      SELECT a.id,
        ARRAY(SELECT DISTINCT value FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(a."eligibilityReasons") = 'array' THEN a."eligibilityReasons" ELSE '[]'::jsonb END
        ) WHERE value <> '' AND value <> 'REVIEW_REQUIRED') AS reasons,
        ARRAY(SELECT DISTINCT value FROM jsonb_array_elements_text(
          CASE WHEN jsonb_typeof(a.risks) = 'array' THEN a.risks ELSE '[]'::jsonb END
        ) WHERE value <> '') AS risks,
        CASE WHEN jsonb_typeof(a."missingInformation") = 'array'
          THEN jsonb_array_length(a."missingInformation") > 0 ELSE false END AS missing
      FROM attempts a WHERE decision = 'NEEDS_REVIEW'
    ), reason_rows AS (
      SELECT id, unnest(CASE
        WHEN cardinality(reasons) > 0 THEN reasons
        WHEN cardinality(risks) > 0 THEN risks
        WHEN missing THEN ARRAY['MISSING_INFORMATION']
        ELSE ARRAY['REVIEW_REQUIRED'] END) AS key FROM review
    )
  `;
}
