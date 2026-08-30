import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChannelConnectionStatus,
  StoreRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { PRODUCT_SYNC_DISPATCHER } from '../product-sync/product-sync.constants';
import type { ProductSyncDispatcher } from '../product-sync/product-sync.types';
import { channelConnectionSelect } from './channel.constants';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import { ConfigureChannelConnectionDto } from './dto/configure-channel-connection.dto';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';
import { ProviderRegistryService } from './providers/provider-registry.service';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderRegistryService,
    private readonly encryption: CredentialsEncryptionService,
    @Inject(PRODUCT_SYNC_DISPATCHER)
    private readonly productSyncQueue: ProductSyncDispatcher,
  ) {}

  async findAvailableProviders(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);
    return this.providers.getAvailableProviders();
  }

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
    const manifest = this.providers.getManifest(dto.providerKey);
    const credentials = this.providers.validateCredentials(
      dto.providerKey,
      dto.environment,
      dto.credentials,
    );
    const existingConnection = await this.prisma.channelConnection.findUnique({
      where: {
        storeId_providerKey: {
          storeId,
          providerKey: dto.providerKey,
        },
      },
      select: { id: true },
    });

    if (existingConnection) {
      throw new ConflictException('Bu satış kanalı mağazaya zaten eklenmiş.');
    }

    await this.providers.verifyCredentials(dto.providerKey, {
      environment: dto.environment,
      credentials,
    });

    return this.prisma.channelConnection.create({
      data: {
        storeId,
        providerKey: dto.providerKey,
        type: manifest.type,
        environment: dto.environment,
        credentialsEncrypted: this.encryption.encrypt(credentials),
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
      },
      select: channelConnectionSelect,
    });
  }

  async configure(
    storeId: string,
    connectionId: string,
    userId: string,
    dto: ConfigureChannelConnectionDto,
  ) {
    await this.requireStoreManagement(storeId, userId);
    const connection = await this.getConnection(storeId, connectionId);
    const credentials = this.providers.validateCredentials(
      connection.providerKey,
      dto.environment,
      dto.credentials,
    );

    await this.providers.verifyCredentials(connection.providerKey, {
      environment: dto.environment,
      credentials,
    });

    return this.prisma.channelConnection.update({
      where: { id: connection.id },
      data: {
        environment: dto.environment,
        credentialsEncrypted: this.encryption.encrypt(credentials),
        credentialSchemaVersion: 1,
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        failureReason: null,
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
    const connection = await this.getConnection(storeId, connectionId);

    if (!connection.credentialsEncrypted) {
      throw new BadRequestException(
        'Bağlantı bilgileri eksik. Kanalı yeniden yapılandırın.',
      );
    }

    const credentials = this.encryption.decrypt(
      connection.credentialsEncrypted,
    );
    await this.providers.verifyCredentials(connection.providerKey, {
      environment: connection.environment,
      credentials,
    });

    return this.prisma.channelConnection.update({
      where: { id: connectionId },
      data: {
        status: ChannelConnectionStatus.CONNECTED,
        connectedAt: new Date(),
        failureReason: null,
      },
      select: channelConnectionSelect,
    });
  }

  async syncCatalog(storeId: string, connectionId: string, userId: string) {
    return this.queueSync(storeId, connectionId, userId, 'FULL');
  }

  async syncInventory(storeId: string, connectionId: string, userId: string) {
    return this.queueSync(storeId, connectionId, userId, 'INVENTORY');
  }

  private async queueSync(
    storeId: string,
    connectionId: string,
    userId: string,
    kind: 'FULL' | 'INVENTORY',
  ) {
    await this.requireStoreManagement(storeId, userId);
    const connection = await this.getConnection(storeId, connectionId);

    if (
      connection.status !== ChannelConnectionStatus.CONNECTED ||
      !connection.credentialsEncrypted
    ) {
      throw new BadRequestException(
        'Ürünleri senkronize etmeden önce kanal bağlantısını tamamlayın.',
      );
    }

    return this.productSyncQueue.enqueue(storeId, connectionId, kind);
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

  private async getConnection(storeId: string, connectionId: string) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, storeId },
      select: {
        id: true,
        providerKey: true,
        environment: true,
        status: true,
        credentialsEncrypted: true,
      },
    });

    if (!connection) {
      throw new NotFoundException('Satış kanalı bağlantısı bulunamadı.');
    }

    return connection;
  }
}
