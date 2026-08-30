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

const POLL_INTERVAL_MS = 100;
const TIMEOUT_MS = 10_000;

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const encryption = app.get(CredentialsEncryptionService);
  const productSync = app.get<ProductSyncDispatcher>(PRODUCT_SYNC_DISPATCHER);
  const questionSync = app.get<QuestionSyncDispatcher>(
    QUESTION_SYNC_DISPATCHER,
  );
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

    await questionSync.enqueue(store.id, connection.id);
    await waitForQuestionSync(prisma, connection.id);
    await questionSync.enqueue(store.id, connection.id);
    await waitForQuestionSync(prisma, connection.id);

    const [events, ignoredEvents, questions, matchedQuestions] =
      await Promise.all([
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
      ]);

    if (
      events !== 3 ||
      ignoredEvents !== 1 ||
      questions !== 2 ||
      matchedQuestions !== 2
    ) {
      throw new Error(
        `Unexpected question ingestion: ${events} events, ${ignoredEvents} ignored, ${questions} questions, ${matchedQuestions} matched.`,
      );
    }

    process.stdout.write(
      `${JSON.stringify({ syncs: 2, events, ignoredEvents, questions, matchedQuestions, duplicateSafe: true })}\n`,
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
