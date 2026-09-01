import { Injectable } from '@nestjs/common';
import {
  AiEmojiPolicy,
  AiResponseLength,
  AiTone,
  IntegrationEnvironment,
  StoreRole,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import {
  CompleteOnboardingDto,
  OnboardingChannel,
} from './dto/complete-onboarding.dto';
import { createDefaultStoreAiInstructions } from '../knowledge/default-ai-instructions';

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
  ) {}

  async getStatus(userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
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
            channelConnections: {
              select: channelConnectionSelect,
            },
          },
        },
      },
    });

    const store = workspace?.stores[0] ?? null;

    return {
      completed: Boolean(workspace && store),
      store: store
        ? {
            id: store.id,
            name: store.name,
          }
        : null,
      channelConnections: store?.channelConnections ?? [],
    };
  }

  async complete(userId: string, dto: CompleteOnboardingDto) {
    const setup = await this.prisma.$transaction(async (transaction) => {
      let workspace = await transaction.workspace.findFirst({
        where: { ownerId: userId },
        orderBy: { createdAt: 'asc' },
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
                select: channelConnectionSelect,
              },
            },
          },
        },
      });

      let storeCreated = false;

      if (!workspace) {
        workspace = await transaction.workspace.create({
          data: {
            name: dto.storeName,
            ownerId: userId,
            members: {
              create: {
                userId,
                role: WorkspaceRole.OWNER,
              },
            },
          },
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
                  select: channelConnectionSelect,
                },
              },
            },
          },
        });
      }

      let store = workspace.stores[0] ?? null;

      if (!store) {
        store = await transaction.store.create({
          data: {
            name: dto.storeName,
            workspaceId: workspace.id,
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
              select: channelConnectionSelect,
            },
          },
        });
        storeCreated = true;
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

    let channelConnection: Awaited<
      ReturnType<ChannelsService['create']>
    > | null = null;
    let catalogSync: Awaited<
      ReturnType<ChannelsService['syncCatalog']>
    > | null = null;

    if (dto.selectedChannel) {
      const providerKey = CHANNEL_PROVIDER_KEY[dto.selectedChannel];
      const environment = dto.environment ?? IntegrationEnvironment.PRODUCTION;
      const credentials = dto.credentials ?? {};
      const connections = await this.channels.findAll(setup.store.id, userId);
      const existingConnection = connections.find(
        (connection) => connection.providerKey === providerKey,
      );

      const connectedChannel = existingConnection
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

      channelConnection = connectedChannel;
      catalogSync = await this.channels.syncCatalog(
        setup.store.id,
        connectedChannel.id,
        userId,
      );
    }

    return {
      completed: true,
      created: {
        store: setup.storeCreated,
      },
      store: setup.store,
      channelConnection,
      catalogSync,
      nextPath: dto.selectedChannel
        ? '/dashboard/catalog/products'
        : '/dashboard',
    };
  }
}
