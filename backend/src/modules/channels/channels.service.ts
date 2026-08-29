import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChannelConnectionStatus,
  StoreRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  CHANNEL_TYPE_BY_PROVIDER,
  channelConnectionSelect,
} from './channel.constants';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    return this.prisma.channelConnection.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
      select: channelConnectionSelect,
    });
  }

  async create(
    storeId: string,
    userId: string,
    dto: CreateChannelConnectionDto,
  ) {
    await this.requireStoreManagement(storeId, userId);

    const existingConnection = await this.prisma.channelConnection.findUnique({
      where: {
        storeId_provider: {
          storeId,
          provider: dto.provider,
        },
      },
      select: { id: true },
    });

    if (existingConnection) {
      throw new ConflictException('Bu satış kanalı mağazaya zaten eklenmiş.');
    }

    return this.prisma.channelConnection.create({
      data: {
        storeId,
        provider: dto.provider,
        type: CHANNEL_TYPE_BY_PROVIDER[dto.provider],
        status: ChannelConnectionStatus.PENDING,
      },
      select: channelConnectionSelect,
    });
  }

  async disconnect(storeId: string, connectionId: string, userId: string) {
    await this.requireStoreManagement(storeId, userId);
    await this.requireConnection(storeId, connectionId);

    return this.prisma.channelConnection.update({
      where: { id: connectionId },
      data: { status: ChannelConnectionStatus.DISCONNECTED },
      select: channelConnectionSelect,
    });
  }

  async reconnect(storeId: string, connectionId: string, userId: string) {
    await this.requireStoreManagement(storeId, userId);
    await this.requireConnection(storeId, connectionId);

    return this.prisma.channelConnection.update({
      where: { id: connectionId },
      data: {
        status: ChannelConnectionStatus.PENDING,
        processingStartedAt: null,
      },
      select: channelConnectionSelect,
    });
  }

  async remove(storeId: string, connectionId: string, userId: string) {
    await this.requireStoreManagement(storeId, userId);
    await this.requireConnection(storeId, connectionId);

    await this.prisma.channelConnection.delete({
      where: { id: connectionId },
    });

    return { deleted: true };
  }

  private async requireStoreMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findUnique({
      where: {
        storeId_userId: { storeId, userId },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }

    return membership;
  }

  private async requireStoreManagement(storeId: string, userId: string) {
    const membership = await this.requireStoreMembership(storeId, userId);

    if (
      membership.role !== StoreRole.OWNER &&
      membership.role !== StoreRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Satış kanallarını yönetme yetkiniz bulunmuyor.',
      );
    }
  }

  private async requireConnection(storeId: string, connectionId: string) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, storeId },
      select: { id: true },
    });

    if (!connection) {
      throw new NotFoundException('Satış kanalı bağlantısı bulunamadı.');
    }
  }
}
