import { Injectable } from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ChannelType,
  StoreRole,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  CompleteOnboardingDto,
  OnboardingChannel,
} from './dto/complete-onboarding.dto';

const CHANNEL_PROVIDER_KEY: Record<OnboardingChannel, string> = {
  [OnboardingChannel.TRENDYOL]: 'trendyol',
  [OnboardingChannel.HEPSIBURADA]: 'hepsiburada',
};

const CHANNEL_TYPE: Record<OnboardingChannel, ChannelType> = {
  [OnboardingChannel.TRENDYOL]: ChannelType.COMMERCE,
  [OnboardingChannel.HEPSIBURADA]: ChannelType.COMMERCE,
};

const channelConnectionSelect = {
  id: true,
  providerKey: true,
  type: true,
  status: true,
} as const;

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.$transaction(async (transaction) => {
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
          },
          include: {
            channelConnections: {
              select: channelConnectionSelect,
            },
          },
        });
        storeCreated = true;
      }

      let channelConnection = store.channelConnections[0] ?? null;

      if (dto.selectedChannel) {
        const providerKey = CHANNEL_PROVIDER_KEY[dto.selectedChannel];

        channelConnection = await transaction.channelConnection.upsert({
          where: {
            storeId_providerKey: {
              storeId: store.id,
              providerKey,
            },
          },
          create: {
            storeId: store.id,
            providerKey,
            type: CHANNEL_TYPE[dto.selectedChannel],
            status: ChannelConnectionStatus.PENDING,
          },
          update: {},
          select: channelConnectionSelect,
        });
      }

      return {
        completed: true,
        created: {
          store: storeCreated,
        },
        store: {
          id: store.id,
          name: store.name,
        },
        channelConnection,
        nextPath: '/dashboard',
      };
    });
  }
}
