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
import type { QuestionDraftDispatcher } from '../src/modules/questions/question-draft.types';
import { SizeGuideDispatcher } from '../src/modules/size-guides/size-guide.types';

describe('Hepsiburada product question flow', () => {
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

  it('persists grouped listings, matches questions by variant SKU, and sends an answer', async () => {
    const listings = readFixture('hepsiburada-listings.json');
    const questions = readFixture('hepsiburada-questions.json');
    const answerAcknowledgement = readFixture(
      'hepsiburada-question-answer.json',
    );
    const questionItems = questions as Array<Record<string, unknown>>;
    const connectedAt = new Date(
      new Date(String(questionItems[0].createdDate)).getTime() - 60_000,
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
    const enqueueDraft = jest.fn().mockResolvedValue(undefined);
    const draftDispatcher = {
      enqueue: enqueueDraft,
    } as QuestionDraftDispatcher;
    const questionWorker = new QuestionSyncWorkerService(
      prisma,
      registry,
      encryption,
      draftDispatcher,
    );
    const queueAdd = jest.fn().mockResolvedValue({});
    const answerDispatcher = new QuestionAnswerQueueService(prisma, registry, {
      add: queueAdd,
    } as unknown as Queue<QuestionAnswerJobData>);
    const answerWorker = new QuestionAnswerWorkerService(
      prisma,
      registry,
      encryption,
    );

    fetchSpy.mockResolvedValueOnce(jsonResponse(listings));
    const fullSync = await createSyncRun(
      resources.connectionId,
      CatalogSyncKind.FULL,
    );
    await productWorker.run(
      {
        storeId: resources.storeId,
        connectionId: resources.connectionId,
        syncRunId: fullSync.id,
        kind: 'FULL',
      },
      () => Promise.resolve(),
    );

    const product = await prisma.product.findFirstOrThrow({
      where: { storeId: resources.storeId },
      include: {
        variants: { orderBy: { sku: 'asc' } },
        externalProducts: {
          include: { variants: { orderBy: { sku: 'asc' } } },
        },
      },
    });
    const completedFullSync = await prisma.catalogSyncRun.findUniqueOrThrow({
      where: { id: fullSync.id },
    });

    expect(product).toMatchObject({
      title: 'Regular Fit Polo Yaka Bubble Kısa Kollu Tişört F6265AX25SM',
      brand: 'DeFacto',
      category: 'T-Shirt',
      status: 'ACTIVE',
    });
    expect(product.variants).toHaveLength(2);
    expect(product.externalProducts).toHaveLength(1);
    expect(product.externalProducts[0].externalId).toBe('HBCV00009U88OT');
    expect(product.externalProducts[0].variants).toHaveLength(2);
    expect(completedFullSync).toMatchObject({
      status: 'COMPLETED',
      productsProcessed: 1,
      variantsProcessed: 2,
    });

    fetchSpy.mockResolvedValueOnce(jsonResponse(listings));
    const inventorySync = await createSyncRun(
      resources.connectionId,
      CatalogSyncKind.INVENTORY,
    );
    await productWorker.run(
      {
        storeId: resources.storeId,
        connectionId: resources.connectionId,
        syncRunId: inventorySync.id,
        kind: 'INVENTORY',
      },
      () => Promise.resolve(),
    );

    expect(
      await prisma.productVariant.findMany({
        where: { productId: product.id },
        orderBy: { sku: 'asc' },
        select: { sku: true, stock: true },
      }),
    ).toEqual([
      { sku: 'F6265AX25SM-M', stock: 2 },
      { sku: 'F6265AX25SM-S', stock: 4 },
    ]);

    fetchSpy.mockResolvedValueOnce(jsonResponse(questions));
    const firstQuestionSync = await createSyncRun(
      resources.connectionId,
      CatalogSyncKind.QUESTION,
    );
    await questionWorker.run({
      storeId: resources.storeId,
      connectionId: resources.connectionId,
      syncRunId: firstQuestionSync.id,
    });

    fetchSpy.mockResolvedValueOnce(jsonResponse(questions));
    const secondQuestionSync = await createSyncRun(
      resources.connectionId,
      CatalogSyncKind.QUESTION,
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
      externalProductId: 'F6265AX25SM-M',
      customerName: 'Ayşe K.',
      status: 'PENDING',
    });
    expect(persistedQuestions[1].externalProductId).toBe('HBCV00009U88OT-S');
    expect(questionRuns.map((run) => run.questionsProcessed)).toEqual([2, 0]);
    expect(enqueueDraft).not.toHaveBeenCalled();

    const queuedAnswer = await answerDispatcher.enqueue({
      storeId: resources.storeId,
      questionId: persistedQuestions[0].id,
      requestedByUserId: resources.userId,
      answer: 'Merhabalar, M beden stoklarımızda mevcuttur.',
    });
    expect(queueAdd).toHaveBeenCalledTimes(1);
    fetchSpy.mockResolvedValueOnce(jsonResponse(answerAcknowledgement, 201));
    await answerWorker.run({
      storeId: resources.storeId,
      answerId: queuedAnswer.id,
    });

    const answeredQuestion = await prisma.productQuestion.findUniqueOrThrow({
      where: { id: persistedQuestions[0].id },
      include: { answerDelivery: true },
    });
    expect(answeredQuestion.status).toBe('ANSWERED');
    expect(answeredQuestion.answerDelivery).toMatchObject({
      status: 'SENT',
      externalAnswerId: null,
      attempts: 1,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  function createSyncRun(connectionId: string, kind: CatalogSyncKind) {
    return prisma.catalogSyncRun.create({ data: { connectionId, kind } });
  }

  async function createTestResources(connectedAt: Date) {
    const user = await prisma.user.create({
      data: {
        name: 'Hepsiburada Integration Test',
        email: `hepsiburada-integration-${Date.now()}-${Math.random()}@example.com`,
      },
    });
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Hepsiburada Integration Workspace',
        ownerId: user.id,
        members: { create: { userId: user.id, role: WorkspaceRole.OWNER } },
      },
    });
    const store = await prisma.store.create({
      data: {
        name: 'Hepsiburada Integration Store',
        workspaceId: workspace.id,
        members: { create: { userId: user.id, role: StoreRole.OWNER } },
      },
    });
    const connection = await prisma.channelConnection.create({
      data: {
        storeId: store.id,
        providerKey: 'hepsiburada',
        type: ChannelType.COMMERCE,
        environment: IntegrationEnvironment.SANDBOX,
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt,
        credentialsEncrypted: encryption.encrypt({
          merchantId: 'merchant-123',
          developerUser: 'integration-test-user',
          serviceKey: 'integration-test-key',
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
      where: { email: { startsWith: 'hepsiburada-integration-' } },
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

function readFixture(name: string): unknown {
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
  ) as unknown;
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
