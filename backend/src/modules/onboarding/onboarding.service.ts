import { Injectable } from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ChannelProvider,
  ChannelType,
  StoreRole,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  CompleteOnboardingDto,
  OnboardingChannel,
} from './dto/complete-onboarding.dto';

const CHANNEL_PROVIDER: Record<OnboardingChannel, ChannelProvider> = {
  [OnboardingChannel.TRENDYOL]: ChannelProvider.TRENDYOL,
  [OnboardingChannel.HEPSIBURADA]: ChannelProvider.HEPSIBURADA,
  [OnboardingChannel.INSTAGRAM]: ChannelProvider.INSTAGRAM,
  [OnboardingChannel.WHATSAPP]: ChannelProvider.WHATSAPP,
  [OnboardingChannel.WOOCOMMERCE]: ChannelProvider.WOOCOMMERCE,
};

const CHANNEL_TYPE: Record<OnboardingChannel, ChannelType> = {
  [OnboardingChannel.TRENDYOL]: ChannelType.COMMERCE,
  [OnboardingChannel.HEPSIBURADA]: ChannelType.COMMERCE,
  [OnboardingChannel.INSTAGRAM]: ChannelType.SOCIAL,
  [OnboardingChannel.WHATSAPP]: ChannelType.MESSAGING,
  [OnboardingChannel.WOOCOMMERCE]: ChannelType.COMMERCE,
};

const channelConnectionSelect = {
  id: true,
  provider: true,
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
        const provider = CHANNEL_PROVIDER[dto.selectedChannel];

        channelConnection = await transaction.channelConnection.upsert({
          where: {
            storeId_provider: {
              storeId: store.id,
              provider,
            },
          },
          create: {
            storeId: store.id,
            provider,
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
