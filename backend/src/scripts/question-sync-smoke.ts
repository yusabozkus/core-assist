import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import {
  ChannelConnectionStatus,
  ChannelType,
  IntegrationEnvironment,
  StoreRole,
  WorkspaceRole,
} from '../generated/prisma/enums';
import { CredentialsEncryptionService } from '../modules/channels/credentials-encryption.service';
import { PRODUCT_SYNC_DISPATCHER } from '../modules/product-sync/product-sync.constants';
import type { ProductSyncDispatcher } from '../modules/product-sync/product-sync.types';
import { QUESTION_SYNC_DISPATCHER } from '../modules/question-sync/question-sync.constants';
import type { QuestionSyncDispatcher } from '../modules/question-sync/question-sync.types';
import { QUESTION_ANSWER_DISPATCHER } from '../modules/question-answer/question-answer.constants';
import type { QuestionAnswerDispatcher } from '../modules/question-answer/question-answer.types';
import { MOCK_PRODUCTS_PER_PROVIDER } from '../modules/channels/providers/mock-catalog.connector';
import {
  MOCK_HISTORICAL_QUESTIONS_PER_PROVIDER,
  MOCK_QUESTIONS_PER_PROVIDER,
} from '../modules/channels/providers/mock-question.connector';
import { QuestionDraftService } from '../modules/questions/question-draft.service';

const POLL_INTERVAL_MS = 100;
const TIMEOUT_MS = 10_000;

async function run() {
  process.env.AI_DRAFT_MODE = 'deterministic';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const encryption = app.get(CredentialsEncryptionService);
  const productSync = app.get<ProductSyncDispatcher>(PRODUCT_SYNC_DISPATCHER);
  const questionSync = app.get<QuestionSyncDispatcher>(
    QUESTION_SYNC_DISPATCHER,
  );
  const questionAnswers = app.get<QuestionAnswerDispatcher>(
    QUESTION_ANSWER_DISPATCHER,
  );
  const questionDrafts = app.get(QuestionDraftService);
  let userId: string | undefined;
  let workspaceId: string | undefined;
  let storeId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: {
        name: 'Question Sync Smoke Test',
        email: `question-smoke-${Date.now()}@example.com`,
      },
      select: { id: true },
    });
    userId = user.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Question Smoke Workspace',
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: WorkspaceRole.OWNER },
        },
      },
      select: { id: true },
    });
    workspaceId = workspace.id;
    const store = await prisma.store.create({
      data: {
        name: 'Question Smoke Store',
        workspaceId: workspace.id,
        members: {
          create: { userId: user.id, role: StoreRole.OWNER },
        },
      },
      select: { id: true },
    });
    storeId = store.id;
    const connection = await prisma.channelConnection.create({
      data: {
        storeId: store.id,
        providerKey: 'trendyol',
        type: ChannelType.COMMERCE,
        environment: IntegrationEnvironment.SANDBOX,
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        credentialsEncrypted: encryption.encrypt({
          supplierId: 'smoke-supplier',
          apiKey: 'smoke-key',
          apiSecret: 'smoke-secret',
        }),
      },
      select: { id: true },
    });
    const queuedCatalog = await productSync.enqueue(store.id, connection.id);
    await waitForCatalogSync(prisma, queuedCatalog.syncRunId);

    const firstQuestionSync = await questionSync.enqueue(
      store.id,
      connection.id,
    );
    await waitForQuestionSync(prisma, connection.id);

    const questionToAnswer = await prisma.productQuestion.findFirstOrThrow({
      where: { connectionId: connection.id },
      orderBy: { externalCreatedAt: 'asc' },
      select: { id: true },
    });
    const generatedDraft = await questionDrafts.generate(
      store.id,
      questionToAnswer.id,
    );
    const queuedAnswer = await questionAnswers.enqueue({
      storeId: store.id,
      questionId: questionToAnswer.id,
      requestedByUserId: user.id,
      answer: generatedDraft.answer,
    });
    await waitForQuestionAnswer(prisma, queuedAnswer.id);

    let duplicateAnswerPrevented = false;

    try {
      await questionAnswers.enqueue({
        storeId: store.id,
        questionId: questionToAnswer.id,
        requestedByUserId: user.id,
        answer: 'Bu cevap ikinci kez gönderilmemeli.',
      });
    } catch {
      duplicateAnswerPrevented = true;
    }
    const secondQuestionSync = await questionSync.enqueue(
      store.id,
      connection.id,
    );
    await waitForQuestionSync(prisma, connection.id);

    const [
      products,
      events,
      ignoredEvents,
      questions,
      matchedQuestions,
      sentAnswers,
      questionSyncRuns,
    ] = await Promise.all([
      prisma.product.count({ where: { storeId: store.id } }),
      prisma.incomingEvent.count({ where: { connectionId: connection.id } }),
      prisma.incomingEvent.count({
        where: { connectionId: connection.id, processingStatus: 'IGNORED' },
      }),
      prisma.productQuestion.count({
        where: { connectionId: connection.id },
      }),
      prisma.productQuestion.count({
        where: { connectionId: connection.id, productId: { not: null } },
      }),
      prisma.questionAnswer.count({
        where: { connectionId: connection.id, status: 'SENT' },
      }),
      prisma.catalogSyncRun.findMany({
        where: {
          id: {
            in: [firstQuestionSync.syncRunId, secondQuestionSync.syncRunId],
          },
        },
        orderBy: { startedAt: 'asc' },
        select: {
          kind: true,
          status: true,
          questionsProcessed: true,
          completedAt: true,
        },
      }),
    ]);

    if (
      products !== MOCK_PRODUCTS_PER_PROVIDER ||
      events !==
        MOCK_QUESTIONS_PER_PROVIDER + MOCK_HISTORICAL_QUESTIONS_PER_PROVIDER ||
      ignoredEvents !== MOCK_HISTORICAL_QUESTIONS_PER_PROVIDER ||
      questions !== MOCK_QUESTIONS_PER_PROVIDER ||
      matchedQuestions !== MOCK_QUESTIONS_PER_PROVIDER ||
      sentAnswers !== 1 ||
      generatedDraft.status !== 'DRAFTED' ||
      generatedDraft.context.source !== 'CATALOG' ||
      !duplicateAnswerPrevented ||
      questionSyncRuns.length !== 2 ||
      questionSyncRuns.some(
        (run) =>
          run.kind !== 'QUESTION' ||
          run.status !== 'COMPLETED' ||
          run.completedAt === null,
      ) ||
      questionSyncRuns[0]?.questionsProcessed !== MOCK_QUESTIONS_PER_PROVIDER ||
      questionSyncRuns[1]?.questionsProcessed !== 0
    ) {
      throw new Error(
        `Unexpected question flow: ${products} products, ${events} events, ${ignoredEvents} ignored, ${questions} questions, ${matchedQuestions} matched, ${sentAnswers} answers.`,
      );
    }

    process.stdout.write(
      `${JSON.stringify({ syncs: 2, questionSyncHistory: questionSyncRuns.map((run) => ({ kind: run.kind, status: run.status, questionsProcessed: run.questionsProcessed })), products, events, ignoredEvents, questions, matchedQuestions, draftedAnswers: 1, sentAnswers, duplicateSafe: true, duplicateAnswerPrevented })}\n`,
    );
  } finally {
    if (storeId) await prisma.store.deleteMany({ where: { id: storeId } });
    if (workspaceId) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    }
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  }
}

async function waitForQuestionAnswer(prisma: PrismaService, answerId: string) {
  const deadline = Date.now() + TIMEOUT_MS;
  let answer = await prisma.questionAnswer.findUniqueOrThrow({
    where: { id: answerId },
    select: { status: true, lastError: true },
  });

  while (
    (answer.status === 'QUEUED' || answer.status === 'PROCESSING') &&
    Date.now() < deadline
  ) {
    await wait(POLL_INTERVAL_MS);
    answer = await prisma.questionAnswer.findUniqueOrThrow({
      where: { id: answerId },
      select: { status: true, lastError: true },
    });
  }

  if (answer.status !== 'SENT') {
    throw new Error(
      answer.lastError ?? 'Question answer smoke test timed out.',
    );
  }
}

async function waitForCatalogSync(prisma: PrismaService, syncRunId: string) {
  const deadline = Date.now() + TIMEOUT_MS;
  let run = await prisma.catalogSyncRun.findUniqueOrThrow({
    where: { id: syncRunId },
    select: { status: true, errorMessage: true },
  });

  while (run.status === 'RUNNING' && Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS);
    run = await prisma.catalogSyncRun.findUniqueOrThrow({
      where: { id: syncRunId },
      select: { status: true, errorMessage: true },
    });
  }

  if (run.status !== 'COMPLETED') {
    throw new Error(run.errorMessage ?? 'Catalog sync timed out.');
  }
}

async function waitForQuestionSync(
  prisma: PrismaService,
  connectionId: string,
) {
  const deadline = Date.now() + TIMEOUT_MS;
  let connection = await prisma.channelConnection.findUniqueOrThrow({
    where: { id: connectionId },
    select: {
      questionSyncStartedAt: true,
      questionSyncFailureReason: true,
    },
  });

  while (connection.questionSyncStartedAt && Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS);
    connection = await prisma.channelConnection.findUniqueOrThrow({
      where: { id: connectionId },
      select: {
        questionSyncStartedAt: true,
        questionSyncFailureReason: true,
      },
    });
  }

  if (connection.questionSyncStartedAt) {
    throw new Error('Question sync smoke test timed out.');
  }

  if (connection.questionSyncFailureReason) {
    throw new Error(connection.questionSyncFailureReason);
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
