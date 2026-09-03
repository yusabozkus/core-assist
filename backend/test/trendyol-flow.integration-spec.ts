import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Queue } from 'bullmq';
import { PrismaService } from '../src/database/prisma.service';
import {
  CatalogSyncKind,
  ChannelConnectionStatus,
  ChannelType,
  IntegrationEnvironment,
  StoreRole,
  WorkspaceRole,
} from '../src/generated/prisma/enums';
import { CredentialsEncryptionService } from '../src/modules/channels/credentials-encryption.service';
import { HepsiburadaConnector } from '../src/modules/channels/providers/hepsiburada.connector';
import { MockCatalogConnector } from '../src/modules/channels/providers/mock-catalog.connector';
import { MockQuestionConnector } from '../src/modules/channels/providers/mock-question.connector';
import { ProviderRegistryService } from '../src/modules/channels/providers/provider-registry.service';
import { TrendyolConnector } from '../src/modules/channels/providers/trendyol.connector';
import { ProductSyncWorkerService } from '../src/modules/product-sync/product-sync-worker.service';
import { QuestionAnswerQueueService } from '../src/modules/question-answer/question-answer-queue.service';
import type { QuestionAnswerJobData } from '../src/modules/question-answer/question-answer.types';
import { QuestionAnswerWorkerService } from '../src/modules/question-answer/question-answer-worker.service';
import { QuestionSyncWorkerService } from '../src/modules/question-sync/question-sync-worker.service';
import { SizeGuideDispatcher } from '../src/modules/size-guides/size-guide.types';

describe('Trendyol product question flow', () => {
  let prisma: PrismaService;
  let encryption: CredentialsEncryptionService;
  let registry: ProviderRegistryService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await cleanupTestResources();
    encryption = new CredentialsEncryptionService();
    registry = new ProviderRegistryService(
      new TrendyolConnector(),
      new HepsiburadaConnector(),
      new MockCatalogConnector(),
      new MockQuestionConnector(),
    );
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    await cleanupTestResources();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('persists catalog and inventory, matches idempotent questions, and sends an answer', async () => {
    const approvedProducts = readFixture('trendyol-approved-products.json');
    const inventory = readFixture('trendyol-inventory.json');
    const questions = readFixture('trendyol-questions.json');
    const questionAnswer = readFixture('trendyol-question-answer.json');
    const questionItems = questions.content as Array<Record<string, unknown>>;
    const connectedAt = new Date(
      Number(questionItems[0].creationDate) - 60_000,
    );
    const resources = await createTestResources(connectedAt);
    const sizeGuides = {
      register: jest.fn().mockResolvedValue(undefined),
    } as unknown as SizeGuideDispatcher;
    const productWorker = new ProductSyncWorkerService(
      prisma,
      registry,
      encryption,
      sizeGuides,
    );
    const questionWorker = new QuestionSyncWorkerService(
      prisma,
      registry,
      encryption,
    );
    const queueAdd = jest.fn().mockResolvedValue({});
    const answerQueue = {
      add: queueAdd,
    } as unknown as Queue<QuestionAnswerJobData>;
    const answerDispatcher = new QuestionAnswerQueueService(
      prisma,
      registry,
      answerQueue,
    );
    const answerWorker = new QuestionAnswerWorkerService(
      prisma,
      registry,
      encryption,
    );

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        ...approvedProducts,
        nextPageToken: null,
        totalPages: 1,
      }),
    );
    const fullSync = await prisma.catalogSyncRun.create({
      data: {
        connectionId: resources.connectionId,
        kind: CatalogSyncKind.FULL,
      },
    });

    await productWorker.run(
      {
        storeId: resources.storeId,
        connectionId: resources.connectionId,
        syncRunId: fullSync.id,
        kind: 'FULL',
      },
      () => Promise.resolve(),
    );

    const persistedProduct = await prisma.product.findFirstOrThrow({
      where: { storeId: resources.storeId },
      include: {
        attributes: { orderBy: { name: 'asc' } },
        images: { orderBy: { position: 'asc' } },
        variants: { orderBy: { sku: 'asc' } },
        externalProducts: {
          include: { variants: { orderBy: { externalId: 'asc' } } },
        },
      },
    });
    const persistedFullSync = await prisma.catalogSyncRun.findUniqueOrThrow({
      where: { id: fullSync.id },
    });

    expect(persistedProduct).toMatchObject({
      title: 'Regular Fit Yazlık Pamuklu Kısa Kollu Beyaz Gömlek D1902AX25SM',
      brand: 'DeFacto',
      category: 'Gömlek',
      status: 'ACTIVE',
    });
    expect(persistedProduct.attributes).toHaveLength(3);
    expect(persistedProduct.images).toHaveLength(2);
    expect(persistedProduct.variants).toHaveLength(2);
    expect(persistedProduct.externalProducts).toHaveLength(1);
    expect(persistedProduct.externalProducts[0]).toMatchObject({
      externalId: 'D1902AX25SM',
      status: 'ACTIVE',
    });
    expect(persistedProduct.externalProducts[0].variants).toHaveLength(2);
    expect(persistedFullSync).toMatchObject({
      status: 'COMPLETED',
      productsProcessed: 1,
      variantsProcessed: 2,
      productsArchived: 0,
    });

    fetchSpy.mockResolvedValueOnce(jsonResponse(inventory));
    const inventorySync = await prisma.catalogSyncRun.create({
      data: {
        connectionId: resources.connectionId,
        kind: CatalogSyncKind.INVENTORY,
      },
    });

    await productWorker.run(
      {
        storeId: resources.storeId,
        connectionId: resources.connectionId,
        syncRunId: inventorySync.id,
        kind: 'INVENTORY',
      },
      () => Promise.resolve(),
    );

    const inventoryVariants = await prisma.productVariant.findMany({
      where: { productId: persistedProduct.id },
      orderBy: { sku: 'asc' },
      select: { sku: true, stock: true, price: true, status: true },
    });
    expect(
      inventoryVariants.map((variant) => ({
        ...variant,
        price: Number(variant.price),
      })),
    ).toEqual([
      {
        sku: '8683526124546',
        stock: 8,
        price: 579.99,
        status: 'ACTIVE',
      },
      {
        sku: '8683526124553',
        stock: 2,
        price: 579.99,
        status: 'ACTIVE',
      },
    ]);

    const firstQuestionSync = await prisma.catalogSyncRun.create({
      data: {
        connectionId: resources.connectionId,
        kind: CatalogSyncKind.QUESTION,
      },
    });
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ ...questions, totalElements: 2, totalPages: 1 }),
    );

    await questionWorker.run({
      storeId: resources.storeId,
      connectionId: resources.connectionId,
      syncRunId: firstQuestionSync.id,
    });

    const secondQuestionSync = await prisma.catalogSyncRun.create({
      data: {
        connectionId: resources.connectionId,
        kind: CatalogSyncKind.QUESTION,
      },
    });
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ ...questions, totalElements: 2, totalPages: 1 }),
    );

    await questionWorker.run({
      storeId: resources.storeId,
      connectionId: resources.connectionId,
      syncRunId: secondQuestionSync.id,
    });

    const persistedQuestions = await prisma.productQuestion.findMany({
      where: { connectionId: resources.connectionId },
      orderBy: { externalQuestionId: 'asc' },
    });
    const questionRuns = await prisma.catalogSyncRun.findMany({
      where: { id: { in: [firstQuestionSync.id, secondQuestionSync.id] } },
      orderBy: { startedAt: 'asc' },
    });

    expect(persistedQuestions).toHaveLength(2);
    expect(persistedQuestions.every((question) => question.productId)).toBe(
      true,
    );
    expect(persistedQuestions[0]).toMatchObject({
      externalProductId: 'D1902AX25SM',
      customerName: 'Mehmet T.',
      status: 'PENDING',
    });
    expect(persistedQuestions[1].customerName).toBeNull();
    expect(questionRuns.map((run) => run.questionsProcessed)).toEqual([2, 0]);
    expect(
      await prisma.incomingEvent.count({
        where: { connectionId: resources.connectionId },
      }),
    ).toBe(2);

    const queuedAnswer = await answerDispatcher.enqueue({
      storeId: resources.storeId,
      questionId: persistedQuestions[0].id,
      requestedByUserId: resources.userId,
      answer: 'Merhabalar, ürünümüz regular kalıptır.',
    });
    expect(queueAdd).toHaveBeenCalledTimes(1);
    fetchSpy.mockResolvedValueOnce(jsonResponse(questionAnswer));

    await answerWorker.run({
      storeId: resources.storeId,
      answerId: queuedAnswer.id,
    });

    const answeredQuestion = await prisma.productQuestion.findUniqueOrThrow({
      where: { id: persistedQuestions[0].id },
      include: { answerDelivery: true },
    });
    expect(answeredQuestion).toMatchObject({
      status: 'ANSWERED',
      answer: 'Merhabalar, ürünümüz regular kalıptır.',
    });
    expect(answeredQuestion.answerDelivery).toMatchObject({
      status: 'SENT',
      externalAnswerId: '55002211',
      attempts: 1,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  async function createTestResources(connectedAt: Date) {
    const user = await prisma.user.create({
      data: {
        name: 'Trendyol Integration Test',
        email: `trendyol-integration-${Date.now()}-${Math.random()}@example.com`,
      },
    });
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Trendyol Integration Workspace',
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: WorkspaceRole.OWNER },
        },
      },
    });
    const store = await prisma.store.create({
      data: {
        name: 'Trendyol Integration Store',
        workspaceId: workspace.id,
        members: {
          create: { userId: user.id, role: StoreRole.OWNER },
        },
      },
    });
    const connection = await prisma.channelConnection.create({
      data: {
        storeId: store.id,
        providerKey: 'trendyol',
        type: ChannelType.COMMERCE,
        environment: IntegrationEnvironment.SANDBOX,
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt,
        credentialsEncrypted: encryption.encrypt({
          supplierId: '123456',
          apiKey: 'integration-test-key',
          apiSecret: 'integration-test-secret',
        }),
      },
    });

    return {
      userId: user.id,
      storeId: store.id,
      connectionId: connection.id,
    };
  }

  async function cleanupTestResources() {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: 'trendyol-integration-' } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);

    if (userIds.length > 0) {
      await prisma.questionAnswer.deleteMany({
        where: { requestedByUserId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  }
});

function readFixture(name: string) {
  return JSON.parse(
    readFileSync(
      join(
        __dirname,
        '..',
        'src',
        'modules',
        'channels',
        'providers',
        'fixtures',
        'contracts',
        name,
      ),
      'utf8',
    ),
  ) as Record<string, unknown>;
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
