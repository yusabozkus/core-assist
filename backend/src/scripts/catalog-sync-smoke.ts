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

const POLL_INTERVAL_MS = 100;
const TIMEOUT_MS = 10_000;

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const encryption = app.get(CredentialsEncryptionService);
  const dispatcher = app.get<ProductSyncDispatcher>(PRODUCT_SYNC_DISPATCHER);
  let userId: string | undefined;
  let workspaceId: string | undefined;
  let storeId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: {
        name: 'Catalog Sync Smoke Test',
        email: `catalog-smoke-${Date.now()}@example.com`,
      },
      select: { id: true },
    });
    userId = user.id;
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Catalog Smoke Workspace',
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
        name: 'Catalog Smoke Store',
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
    const firstQueuedSync = await dispatcher.enqueue(store.id, connection.id);
    await waitForCompletedSync(prisma, firstQueuedSync.syncRunId);
    const firstVariantIds = await prisma.productVariant.findMany({
      where: { product: { storeId: store.id } },
      orderBy: { sku: 'asc' },
      select: { id: true },
    });
    const secondQueuedSync = await dispatcher.enqueue(store.id, connection.id);
    await waitForCompletedSync(prisma, secondQueuedSync.syncRunId);
    const inventorySync = await dispatcher.enqueue(
      store.id,
      connection.id,
      'INVENTORY',
    );
    const syncRun = await waitForCompletedSync(prisma, inventorySync.syncRunId);

    const [products, variants, externalVariants, outOfStock, finalVariantIds] =
      await Promise.all([
        prisma.product.count({ where: { storeId: store.id } }),
        prisma.productVariant.count({
          where: { product: { storeId: store.id } },
        }),
        prisma.externalProductVariant.count({
          where: { externalProduct: { connectionId: connection.id } },
        }),
        prisma.productVariant.count({
          where: {
            product: { storeId: store.id },
            status: 'OUT_OF_STOCK',
          },
        }),
        prisma.productVariant.findMany({
          where: { product: { storeId: store.id } },
          orderBy: { sku: 'asc' },
          select: { id: true },
        }),
      ]);

    if (
      products !== 2 ||
      variants !== 5 ||
      externalVariants !== 5 ||
      outOfStock !== 1
    ) {
      throw new Error(
        `Unexpected normalized catalog: ${products} products, ${variants} variants, ${externalVariants} external variants.`,
      );
    }

    if (
      firstVariantIds.map((variant) => variant.id).join(',') !==
      finalVariantIds.map((variant) => variant.id).join(',')
    ) {
      throw new Error('Variant identities changed between catalog syncs.');
    }

    process.stdout.write(
      `${JSON.stringify({ status: syncRun.status, syncs: 3, products, variants, externalVariants, stableVariantIds: true })}\n`,
    );
  } finally {
    if (storeId) {
      await prisma.store.deleteMany({ where: { id: storeId } });
    }
    if (workspaceId) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await app.close();
  }
}

async function waitForCompletedSync(prisma: PrismaService, syncRunId: string) {
  const deadline = Date.now() + TIMEOUT_MS;
  let syncRun = await prisma.catalogSyncRun.findUniqueOrThrow({
    where: { id: syncRunId },
    select: { status: true, errorMessage: true },
  });

  while (syncRun.status === 'RUNNING' && Date.now() < deadline) {
    await wait(POLL_INTERVAL_MS);
    syncRun = await prisma.catalogSyncRun.findUniqueOrThrow({
      where: { id: syncRunId },
      select: { status: true, errorMessage: true },
    });
  }

  if (syncRun.status !== 'COMPLETED') {
    throw new Error(
      syncRun.errorMessage ?? 'Product sync smoke test timed out.',
    );
  }

  return syncRun;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
