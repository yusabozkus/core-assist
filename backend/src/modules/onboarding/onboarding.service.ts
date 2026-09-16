import { ConflictException, Injectable } from '@nestjs/common';
import {
  AiEmojiPolicy,
  AiResponseLength,
  AiTone,
  CatalogSyncKind,
  CatalogSyncStatus,
  ChannelConnectionStatus,
  IntegrationEnvironment,
  StoreRole,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import {
  CompleteOnboardingDto,
  OnboardingChannel,
  ProvisionOnboardingDto,
} from './dto/complete-onboarding.dto';
import { createDefaultStoreAiInstructions } from '../knowledge/default-ai-instructions';
import { BillingEntitlementService } from '../billing/billing-entitlement.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const CHANNEL_PROVIDER_KEY: Record<OnboardingChannel, string> = {
  [OnboardingChannel.TRENDYOL]: 'trendyol',
  [OnboardingChannel.HEPSIBURADA]: 'hepsiburada',
};

const channelConnectionSelect = {
  id: true,
  providerKey: true,
  type: true,
  status: true,
} as const;

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly billingEntitlements: BillingEntitlementService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async getStatus(userId: string) {
    const [user, workspace] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingCompletedAt: true },
      }),
      this.prisma.workspace.findFirst({
        where: {
          members: {
            some: { userId },
          },
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          stores: {
            where: {
              members: {
                some: { userId },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: {
              id: true,
              name: true,
              inventoryPolicy: true,
              knowledgeProfile: {
                select: {
                  brandDescription: true,
                  tone: true,
                  responseLength: true,
                },
              },
              channelConnections: {
                where: { removedAt: null },
                select: {
                  ...channelConnectionSelect,
                  syncRuns: {
                    where: {
                      kind: CatalogSyncKind.FULL,
                    },
                    orderBy: { startedAt: 'desc' as const },
                    take: 1,
                    select: {
                      id: true,
                      status: true,
                      stage: true,
                      progress: true,
                      productsProcessed: true,
                      productsSkipped: true,
                      errorMessage: true,
                      startedAt: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const store = workspace?.stores[0] ?? null;
    const hasReadyCatalogSync = Boolean(
      store?.channelConnections.some((connection) => {
        const syncRun = connection.syncRuns[0];
        return (
          connection.status === ChannelConnectionStatus.CONNECTED &&
          syncRun !== undefined &&
          (syncRun.status === CatalogSyncStatus.COMPLETED ||
            (syncRun.status === CatalogSyncStatus.RUNNING &&
              syncRun.productsProcessed > 0))
        );
      }),
    );
    const latestCatalogSync = store?.channelConnections
      .flatMap((connection) =>
        connection.syncRuns.map((syncRun) => ({
          ...syncRun,
          connectionId: connection.id,
          providerKey: connection.providerKey,
        })),
      )
      .sort(
        (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
      )[0];
    const completed = Boolean(user?.onboardingCompletedAt && store);
    const stage = completed
      ? 'COMPLETED'
      : !store
        ? 'STORE'
        : hasReadyCatalogSync
          ? 'PREFERENCES'
          : latestCatalogSync?.status === CatalogSyncStatus.RUNNING
            ? 'SYNCING'
            : 'CHANNEL';

    return {
      completed,
      completedAt: completed ? (user?.onboardingCompletedAt ?? null) : null,
      stage,
      store: store
        ? {
            id: store.id,
            name: store.name,
            inventoryPolicy: store.inventoryPolicy,
          }
        : null,
      profile: store?.knowledgeProfile ?? null,
      channelConnections:
        store?.channelConnections.map((connection) => ({
          id: connection.id,
          providerKey: connection.providerKey,
          type: connection.type,
          status: connection.status,
        })) ?? [],
      catalogSync: latestCatalogSync
        ? {
            syncRunId: latestCatalogSync.id,
            connectionId: latestCatalogSync.connectionId,
            providerKey: latestCatalogSync.providerKey,
            status: latestCatalogSync.status,
            stage: latestCatalogSync.stage,
            progress: latestCatalogSync.progress,
            productsProcessed: latestCatalogSync.productsProcessed,
            productsSkipped: latestCatalogSync.productsSkipped,
            errorMessage: latestCatalogSync.errorMessage,
          }
        : null,
    };
  }

  async provision(userId: string, dto: ProvisionOnboardingDto) {
    const setup = await this.prisma.$transaction(async (transaction) => {
      const ownedWorkspace =
        await this.workspaces.getOrCreateOwnedWorkspaceInTransaction(
          transaction,
          userId,
          dto.storeName,
        );
      const workspace = await transaction.workspace.findUniqueOrThrow({
        where: { id: ownedWorkspace.id },
        include: {
          stores: {
            where: {
              members: {
                some: { userId },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 1,
            include: {
              channelConnections: {
                where: { removedAt: null },
                select: channelConnectionSelect,
              },
            },
          },
        },
      });

      let storeCreated = false;

      let store = workspace.stores[0] ?? null;

      if (!store) {
        await this.billingEntitlements.assertStoreCapacityInTransaction(
          transaction,
          workspace.id,
        );
        store = await transaction.store.create({
          data: {
            name: dto.storeName,
            workspaceId: workspace.id,
            inventoryPolicy: dto.inventoryPolicy,
            members: {
              create: {
                userId,
                role: StoreRole.OWNER,
              },
            },
            aiInstructions: {
              create: createDefaultStoreAiInstructions(),
            },
          },
          include: {
            channelConnections: {
              where: { removedAt: null },
              select: channelConnectionSelect,
            },
          },
        });
        storeCreated = true;
      } else if (store.inventoryPolicy !== dto.inventoryPolicy) {
        store = await transaction.store.update({
          where: { id: store.id },
          data: { inventoryPolicy: dto.inventoryPolicy },
          include: {
            channelConnections: {
              where: { removedAt: null },
              select: channelConnectionSelect,
            },
          },
        });
      }

      await transaction.storeKnowledgeProfile.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          brandDescription: dto.brandDescription || null,
          tone: dto.tone ?? AiTone.PROFESSIONAL,
          responseLength: dto.responseLength ?? AiResponseLength.BALANCED,
          greetingEnabled: dto.greetingEnabled ?? true,
          closingEnabled: dto.closingEnabled ?? true,
          emojiPolicy: dto.emojiPolicy ?? AiEmojiPolicy.NEVER,
          preferredEmoji: dto.preferredEmoji || null,
          emojiEnabled:
            dto.emojiPolicy !== undefined
              ? dto.emojiPolicy !== AiEmojiPolicy.NEVER
              : false,
        },
        update: {
          ...(dto.brandDescription !== undefined
            ? { brandDescription: dto.brandDescription || null }
            : {}),
          ...(dto.tone !== undefined ? { tone: dto.tone } : {}),
          ...(dto.responseLength !== undefined
            ? { responseLength: dto.responseLength }
            : {}),
          ...(dto.greetingEnabled !== undefined
            ? { greetingEnabled: dto.greetingEnabled }
            : {}),
          ...(dto.closingEnabled !== undefined
            ? { closingEnabled: dto.closingEnabled }
            : {}),
          ...(dto.emojiPolicy !== undefined
            ? {
                emojiPolicy: dto.emojiPolicy,
                emojiEnabled: dto.emojiPolicy !== AiEmojiPolicy.NEVER,
              }
            : {}),
          ...(dto.preferredEmoji !== undefined
            ? { preferredEmoji: dto.preferredEmoji || null }
            : {}),
        },
      });

      return {
        storeCreated,
        store: {
          id: store.id,
          name: store.name,
        },
      };
    });

    const providerKey = CHANNEL_PROVIDER_KEY[dto.selectedChannel];
    const environment = dto.environment ?? IntegrationEnvironment.PRODUCTION;
    const credentials = dto.credentials ?? {};
    const connections = await this.channels.findAll(setup.store.id, userId);
    const existingConnection = connections.find(
      (connection) => connection.providerKey === providerKey,
    );

    const channelConnection = existingConnection
      ? await this.channels.configure(
          setup.store.id,
          existingConnection.id,
          userId,
          { environment, credentials },
        )
      : await this.channels.create(setup.store.id, userId, {
          providerKey,
          environment,
          credentials,
        });

    const catalogSync = await this.channels.syncCatalog(
      setup.store.id,
      channelConnection.id,
      userId,
    );

    return {
      completed: false,
      created: {
        store: setup.storeCreated,
      },
      store: setup.store,
      channelConnection,
      catalogSync,
      nextStep: 'CATALOG_SYNC' as const,
    };
  }

  async complete(userId: string, dto: CompleteOnboardingDto) {
    return this.prisma.$transaction(async (transaction) => {
      const store = await transaction.store.findFirst({
        where: {
          id: dto.storeId,
          status: StoreStatus.ACTIVE,
          members: { some: { userId } },
          channelConnections: {
            some: {
              removedAt: null,
              status: ChannelConnectionStatus.CONNECTED,
              credentialsEncrypted: { not: null },
              syncRuns: {
                some: {
                  kind: CatalogSyncKind.FULL,
                  OR: [
                    { status: CatalogSyncStatus.COMPLETED },
                    {
                      status: CatalogSyncStatus.RUNNING,
                      productsProcessed: { gt: 0 },
                    },
                  ],
                },
              },
            },
          },
        },
        select: { id: true, name: true },
      });

      if (!store) {
        throw new ConflictException(
          'Onboarding tamamlanmadan önce kanal bağlantısını ve ilk katalog senkronizasyonunu hazırlayın.',
        );
      }

      await transaction.storeKnowledgeProfile.upsert({
        where: { storeId: store.id },
        create: {
          storeId: store.id,
          tone: dto.tone,
          responseLength: dto.responseLength,
        },
        update: {
          tone: dto.tone,
          responseLength: dto.responseLength,
        },
      });

      await transaction.store.update({
        where: { id: store.id },
        data: { inventoryPolicy: dto.inventoryPolicy },
      });

      const completedAt = new Date();
      await transaction.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: completedAt },
      });

      return {
        completed: true as const,
        completedAt,
        store,
        nextPath: '/dashboard/catalog/products',
      };
    });
  }
}
