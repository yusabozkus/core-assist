import { createHmac, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisConnection } from '../../infrastructure/queue/redis-connection';
import { AiDraftGenerator, AiDraftRateLimitError } from '../ai/ai-draft.types';
import { applyHeightWeightSizeRecommendation } from '../questions/height-weight-size-recommendation';
import { analyzeProductQuestion } from '../questions/product-answer-context.service';
import type {
  ProductAnswerContext,
  ProductAnswerFact,
} from '../questions/product-answer-context.types';
import { applyInventoryFreshnessGuard } from '../questions/question-draft.service';
import { QuestionReplyDecisionService } from '../questions/question-reply-decision.service';
import { evaluateQuestionResponsePolicy } from '../questions/question-response-policy.service';
import type { LandingDemoQuestionDto } from './dto/landing-demo-question.dto';
import {
  LANDING_DEMO_PRODUCTS,
  LANDING_DEMO_STORE_EVIDENCE,
  type LandingDemoProduct,
} from './landing-demo.products';

const LOCK_MS = 70_000;
const QUESTION_LIMIT = 10;
const QUESTION_WINDOW_MS = 24 * 60 * 60 * 1000;

const RELEASE_SCRIPT = [
  "if redis.call('GET', KEYS[1]) == ARGV[1] then",
  "  return redis.call('DEL', KEYS[1])",
  'end',
  'return 0',
].join('\n');

const CONSUME_QUESTION_SCRIPT = [
  "local count = tonumber(redis.call('GET', KEYS[1]) or '0')",
  'if count >= tonumber(ARGV[1]) then',
  "  return {0, count, redis.call('PTTL', KEYS[1])}",
  'end',
  "count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end",
  "return {1, count, redis.call('PTTL', KEYS[1])}",
].join('\n');

type LandingDemoUsage = {
  limit: number;
  remaining: number;
  resetAt: string | null;
};

@Injectable()
export class LandingDemoService implements OnModuleDestroy {
  private readonly logger = new Logger(LandingDemoService.name);
  private readonly redis = new Redis({
    ...getRedisConnection(),
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: 1000,
    commandTimeout: 1000,
  });

  constructor(
    private readonly drafts: AiDraftGenerator,
    private readonly replyDecisions: QuestionReplyDecisionService,
  ) {}

  products() {
    return LANDING_DEMO_PRODUCTS.map(
      ({ id, title, subtitle, art, highlights, examples, catalog }) => ({
        id,
        title,
        subtitle,
        art,
        highlights,
        examples,
        category: catalog.category,
        color: catalog.color,
      }),
    );
  }

  usage(ipAddress: string): Promise<LandingDemoUsage> {
    return this.readUsage(this.quotaKey(ipAddress));
  }

  async answer(input: LandingDemoQuestionDto, ipAddress: string) {
    const product = LANDING_DEMO_PRODUCTS.find(
      (item) => item.id === input.productId,
    );
    if (!product) throw new BadRequestException('Örnek ürün bulunamadı.');
    if (
      evaluateQuestionResponsePolicy(input.question).action === 'DO_NOT_REPLY'
    ) {
      throw new BadRequestException(
        'Bu soruya demo üzerinden yanıt verilemiyor.',
      );
    }

    const fingerprint = demoFingerprint(ipAddress);
    const lockKey = 'coreassist:landing-demo:lock:' + fingerprint;
    const quotaKey = 'coreassist:landing-demo:questions:' + fingerprint;
    const token = randomUUID();

    let acquired: string | null;
    try {
      acquired = await this.redis.set(lockKey, token, 'PX', LOCK_MS, 'NX');
    } catch {
      throw new ServiceUnavailableException('Demo şu anda kullanılamıyor.');
    }

    if (acquired !== 'OK') {
      const remainingMs = await this.redis.pttl(lockKey).catch(() => 5000);
      throw new HttpException(
        {
          code: 'DEMO_BUSY',
          message: 'Önceki yanıt hazırlanıyor. Birazdan tekrar deneyin.',
          retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const currentUsage = await this.readUsage(quotaKey);
      if (currentUsage.remaining === 0) {
        throw demoLimitException(currentUsage);
      }

      const context = buildDemoContext(product, input.question);
      const draft = await this.drafts.generate(context);
      if (!draft) {
        throw new ServiceUnavailableException('Demo şu anda kullanılamıyor.');
      }
      const guardedDraft = applyInventoryFreshnessGuard(draft, context);
      const decision = this.replyDecisions.evaluate(guardedDraft);
      const sources = [
        ...new Set(
          context.evidence
            .filter((item) => guardedDraft.usedEvidenceIds.includes(item.id))
            .map((item) => demoSourceLabel(item.label)),
        ),
      ];
      const usage = await this.consumeQuestion(quotaKey);
      return {
        answer: guardedDraft.answer,
        needsReview: decision === 'NEEDS_REVIEW',
        sources,
        usage,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof AiDraftRateLimitError) {
        throw new HttpException(
          {
            code: 'AI_RATE_LIMITED',
            message: 'AI şu anda yoğun. Biraz sonra yeniden deneyin.',
            retryAfterSeconds: error.retryAfterSeconds ?? 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      this.logger.warn(
        'Landing demo answer could not be generated: ' +
          (error instanceof Error ? error.name : 'unknown'),
      );
      throw new ServiceUnavailableException(
        'Yanıt hazırlanamadı. Lütfen biraz sonra yeniden deneyin.',
      );
    } finally {
      try {
        await this.redis.eval(RELEASE_SCRIPT, 1, lockKey, token);
      } catch {
        this.logger.warn('Landing demo request lock could not be released.');
      }
    }
  }

  private quotaKey(ipAddress: string) {
    return 'coreassist:landing-demo:questions:' + demoFingerprint(ipAddress);
  }

  private async readUsage(key: string): Promise<LandingDemoUsage> {
    try {
      const [count, remainingMs] = await Promise.all([
        this.redis.get(key),
        this.redis.pttl(key),
      ]);
      return demoUsage(Number(count) || 0, remainingMs);
    } catch {
      throw new ServiceUnavailableException('Demo şu anda kullanılamıyor.');
    }
  }

  private async consumeQuestion(key: string): Promise<LandingDemoUsage> {
    let result: [number, number, number];
    try {
      result = (await this.redis.eval(
        CONSUME_QUESTION_SCRIPT,
        1,
        key,
        String(QUESTION_LIMIT),
        String(QUESTION_WINDOW_MS),
      )) as [number, number, number];
    } catch {
      throw new ServiceUnavailableException('Demo şu anda kullanılamıyor.');
    }
    const usage = demoUsage(result[1], result[2]);
    if (result[0] !== 1) throw demoLimitException(usage);
    return usage;
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}

function demoFingerprint(ipAddress: string) {
  return createHmac(
    'sha256',
    process.env.BETTER_AUTH_SECRET?.trim() || 'landing-demo-development-only',
  )
    .update(ipAddress.trim() || 'unknown')
    .digest('hex');
}

function demoUsage(count: number, remainingMs: number): LandingDemoUsage {
  return {
    limit: QUESTION_LIMIT,
    remaining: Math.max(0, QUESTION_LIMIT - count),
    resetAt:
      remainingMs > 0 ? new Date(Date.now() + remainingMs).toISOString() : null,
  };
}

function demoLimitException(usage: LandingDemoUsage) {
  return new HttpException(
    {
      code: 'DEMO_LIMIT_REACHED',
      message: '24 saatlik demo soru hakkınız doldu.',
      ...usage,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function buildDemoContext(
  product: LandingDemoProduct,
  question: string,
): ProductAnswerContext {
  const now = new Date().toISOString();
  const analyzed = analyzeProductQuestion({
    questionId: randomUUID(),
    question,
    providerKey: 'trendyol',
    product: {
      id: product.id,
      title: product.title,
      description: product.catalog.description,
      brand: 'Örnek Mağaza',
      category: product.catalog.category,
      attributes: [
        ...product.catalog.attributes,
        { name: 'Renk', value: product.catalog.color },
      ],
      variants: product.catalog.sizes.map(({ size, stock }) => ({
        title: `${product.catalog.color} / ${size}`,
        sku: `DEMO-${product.id}-${size}`,
        color: product.catalog.color,
        size,
        price: product.catalog.price,
        currency: 'TRY',
        stock,
        status: stock > 0 ? ('ACTIVE' as const) : ('OUT_OF_STOCK' as const),
        lastSyncedAt: now,
      })),
      sizeGuides: product.catalog.sizeGuides ?? [],
    },
  });
  const productFacts: ProductAnswerContext['evidence'] = product.evidence.map(
    (item) => ({
      ...item,
      fact: demoFact(item.id),
      source: 'MERCHANT_VERIFIED',
      confidence: 1,
    }),
  );
  return applyHeightWeightSizeRecommendation({
    ...analyzed,
    inventoryVerification: { status: 'VERIFIED', checkedAt: now },
    evidence: [
      ...analyzed.evidence,
      ...productFacts,
      ...LANDING_DEMO_STORE_EVIDENCE,
    ],
    responsePreferences: {
      automationMode: 'OFF',
      minimumAutoSendConfidence: 0.85,
      tone: 'FRIENDLY',
      responseLength: 'BALANCED',
      greetingEnabled: true,
      closingEnabled: true,
      emojiPolicy: 'NEVER',
      preferredEmoji: null,
      heightWeightSizeRecommendationEnabled: true,
      instructions: [],
      approvedAnswerExamples: [],
    },
  });
}

function demoFact(id: string): ProductAnswerFact {
  switch (id) {
    case 'material':
      return 'MATERIAL';
    case 'fit':
      return 'FIT';
    case 'sizes':
    case 'size-guide':
      return 'SIZE';
    case 'care':
      return 'CARE';
    default:
      return 'PRODUCT_INFO';
  }
}

function demoSourceLabel(label: string) {
  const labels: Record<string, string> = {
    MATERIAL: 'Ürün materyali',
    FIT: 'Ürün kalıbı',
    CARE: 'Bakım talimatı',
    'Eşleşen varyant stoğu': 'Örnek stok bilgisi',
  };
  return labels[label] ?? label;
}
