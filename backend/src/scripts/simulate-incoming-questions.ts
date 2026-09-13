import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import {
  AiAutomationMode,
  ChannelConnectionStatus,
  ExternalEntityStatus,
  IncomingEventProcessingStatus,
  IncomingEventType,
  IntegrationEnvironment,
  ProductQuestionStatus,
  ProductStatus,
  StoreStatus,
} from '../generated/prisma/enums';
import { QUESTION_DRAFT_DISPATCHER } from '../modules/questions/question-draft.constants';
import type { QuestionDraftDispatcher } from '../modules/questions/question-draft.types';

const DEFAULT_QUESTION_COUNT = 5;
const DEFAULT_INTERVAL_MS = 5_000;
const MAX_QUESTION_COUNT = 20;

const QUESTION_TEMPLATES = [
  'Merhaba, bu ürünün kalıbı nasıldır?',
  'Ürünün kumaş ve materyal bilgisi nedir?',
  'Bu ürünün farklı renk seçenekleri bulunuyor mu?',
  'Ürünü beğenmezsem iade veya değişim yapabilir miyim?',
  'Merhaba, bu ürünün stok bilgisi güncel mi?',
] as const;

const CUSTOMER_NAMES = [
  'Ayşe K.',
  'Mehmet T.',
  'Zeynep Y.',
  'Emre A.',
  'Elif S.',
] as const;

async function run() {
  assertDevelopmentEnvironment();

  const options = parseOptions(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const questionDrafts = app.get<QuestionDraftDispatcher>(
    QUESTION_DRAFT_DISPATCHER,
  );

  try {
    const connection = await selectConnection(prisma, options);
    const products = await prisma.externalProduct.findMany({
      where: {
        connectionId: connection.id,
        status: ExternalEntityStatus.ACTIVE,
        product: { status: ProductStatus.ACTIVE },
      },
      orderBy: [{ lastSyncedAt: 'desc' }, { id: 'asc' }],
      take: options.count,
      select: {
        id: true,
        externalId: true,
        product: {
          select: {
            id: true,
            title: true,
            images: {
              orderBy: [{ position: 'asc' }, { id: 'asc' }],
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    });

    if (products.length === 0) {
      throw new Error(
        'Seçilen kanalda aktif ürün bulunamadı. Önce ürün senkronizasyonunu çalıştırın.',
      );
    }

    const automaticDraftsEnabled =
      connection.store.knowledgeProfile?.automationMode ===
        AiAutomationMode.SHADOW ||
      connection.store.knowledgeProfile?.automationMode ===
        AiAutomationMode.SAFE_AUTO;

    console.log(
      `\n${connection.store.name} mağazasında ${connection.providerKey} kanalı kullanılacak.`,
    );
    console.log(
      `${options.count} soru, ${options.intervalMs / 1_000} saniye aralıkla gönderilecek.`,
    );
    console.log(
      automaticDraftsEnabled
        ? 'Otomatik taslak modu açık; yeni sorular taslak kuyruğuna alınacak.\n'
        : 'Otomatik taslak modu kapalı; sorular bekleyen olarak oluşturulacak.\n',
    );

    for (let index = 0; index < options.count; index += 1) {
      if (index > 0) await delay(options.intervalMs);

      const product = products[index % products.length];
      const externalQuestionId = `local-simulation-${Date.now()}-${randomUUID()}`;
      const createdAt = new Date();
      const text =
        QUESTION_TEMPLATES[index % QUESTION_TEMPLATES.length] ??
        `Bu ürün hakkında ${index + 1}. test sorusu.`;
      const customerName =
        CUSTOMER_NAMES[index % CUSTOMER_NAMES.length] ?? 'Test Müşterisi';

      const question = await prisma.$transaction(async (transaction) => {
        const event = await transaction.incomingEvent.create({
          data: {
            storeId: connection.storeId,
            connectionId: connection.id,
            externalEventId: externalQuestionId,
            eventType: IncomingEventType.PRODUCT_QUESTION,
            externalCreatedAt: createdAt,
            payload: {
              simulated: true,
              source: 'simulate-incoming-questions',
              provider: connection.providerKey,
              productExternalId: product.externalId,
            },
          },
          select: { id: true },
        });

        const createdQuestion = await transaction.productQuestion.create({
          data: {
            storeId: connection.storeId,
            connectionId: connection.id,
            incomingEventId: event.id,
            productId: product.product.id,
            externalProductRecordId: product.id,
            productTitleSnapshot: product.product.title,
            productImageUrlSnapshot: product.product.images[0]?.url ?? null,
            externalQuestionId,
            externalProductId: product.externalId,
            externalCustomerId: `local-customer-${index + 1}`,
            customerName,
            question: text,
            status: ProductQuestionStatus.PENDING,
            externalCreatedAt: createdAt,
          },
          select: { id: true },
        });

        await transaction.incomingEvent.update({
          where: { id: event.id },
          data: {
            processingStatus: IncomingEventProcessingStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        return createdQuestion;
      });

      if (automaticDraftsEnabled) {
        await questionDrafts.enqueue(connection.storeId, question.id);
      }

      const state = await prisma.productQuestion.findUniqueOrThrow({
        where: { id: question.id },
        select: { draftProcessingStatus: true },
      });
      const draftState = automaticDraftsEnabled
        ? (state.draftProcessingStatus ?? 'BEKLENİYOR')
        : 'KAPALI';

      console.log(
        `[${index + 1}/${options.count}] ${customerName} → ${product.product.title}`,
      );
      console.log(`  “${text}” · Taslak: ${draftState}`);
    }

    console.log(
      '\nSimülasyon tamamlandı. Gelen kutusu açıksa sorular canlı yenilemeyle görünmelidir.',
    );
  } finally {
    await app.close();
  }
}

type SimulationOptions = {
  storeId?: string;
  connectionId?: string;
  provider?: string;
  count: number;
  intervalMs: number;
};

function parseOptions(args: string[]): SimulationOptions {
  if (args.includes('--help')) {
    console.log(`
Kullanım:
  npm run simulate:questions
  npm run simulate:questions -- --store-id=<uuid>
  npm run simulate:questions -- --provider=trendyol --count=5 --interval=5000

Seçenekler:
  --store-id       Belirli bir mağazayı kullanır.
  --connection-id  Belirli bir kanal bağlantısını kullanır.
  --provider       trendyol veya hepsiburada kanalını seçer.
  --count          Oluşturulacak soru sayısı (1-${MAX_QUESTION_COUNT}).
  --interval       Sorular arasındaki süre, milisaniye (en az 1000).
`);
    process.exit(0);
  }

  const count = parseIntegerOption(
    optionValue(args, 'count'),
    DEFAULT_QUESTION_COUNT,
    1,
    MAX_QUESTION_COUNT,
    'count',
  );
  const intervalMs = parseIntegerOption(
    optionValue(args, 'interval'),
    DEFAULT_INTERVAL_MS,
    1_000,
    60_000,
    'interval',
  );

  return {
    storeId: optionValue(args, 'store-id'),
    connectionId: optionValue(args, 'connection-id'),
    provider: optionValue(args, 'provider')?.toLowerCase(),
    count,
    intervalMs,
  };
}

async function selectConnection(
  prisma: PrismaService,
  options: SimulationOptions,
) {
  const connections = await prisma.channelConnection.findMany({
    where: {
      ...(options.connectionId ? { id: options.connectionId } : {}),
      ...(options.storeId ? { storeId: options.storeId } : {}),
      ...(options.provider ? { providerKey: options.provider } : {}),
      status: ChannelConnectionStatus.CONNECTED,
      environment: IntegrationEnvironment.SANDBOX,
      store: { status: StoreStatus.ACTIVE },
      externalProducts: {
        some: {
          status: ExternalEntityStatus.ACTIVE,
          product: { status: ProductStatus.ACTIVE },
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      storeId: true,
      providerKey: true,
      store: {
        select: {
          name: true,
          knowledgeProfile: { select: { automationMode: true } },
        },
      },
    },
  });

  if (connections.length === 0) {
    throw new Error('Aktif ürünü bulunan bağlı bir SANDBOX kanalı bulunamadı.');
  }

  const distinctStoreIds = new Set(
    connections.map((connection) => connection.storeId),
  );
  if (!options.storeId && !options.connectionId && distinctStoreIds.size > 1) {
    const candidates = connections
      .map(
        (connection) =>
          `- ${connection.store.name}: npm run simulate:questions -- --store-id=${connection.storeId}`,
      )
      .filter((value, index, values) => values.indexOf(value) === index)
      .join('\n');

    throw new Error(
      `Birden fazla uygun mağaza bulundu. Hedef mağazayı seçin:\n${candidates}`,
    );
  }

  return connections[0];
}

function optionValue(args: string[], name: string) {
  const prefix = `--${name}=`;
  return args
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function parseIntegerOption(
  rawValue: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  if (rawValue === undefined) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `--${name} değeri ${minimum} ile ${maximum} arasında bir tam sayı olmalı.`,
    );
  }
  return value;
}

function assertDevelopmentEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Bu simülasyon production ortamında çalıştırılamaz.');
  }
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

void run().catch((error: unknown) => {
  console.error(
    `\nSimülasyon başarısız: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
