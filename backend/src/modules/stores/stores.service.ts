import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  QuestionAnswerStatus,
  StoreRole,
  StoreStatus,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { CreateStoreDto } from './dto/create-store.dto';
import {
  DeleteStoreDto,
  STORE_DELETE_CONFIRMATION,
} from './dto/delete-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PrismaService } from '../../database/prisma.service';
import { createDefaultStoreAiInstructions } from '../knowledge/default-ai-instructions';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createStoreDto: CreateStoreDto) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: {
        userId,
        role: {
          in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const membership =
      memberships.find((candidate) => candidate.role === WorkspaceRole.OWNER) ??
      memberships[0];

    if (!membership) {
      throw new ForbiddenException('Mağaza oluşturma yetkiniz bulunmuyor.');
    }

    return this.prisma.store.create({
      data: {
        name: createStoreDto.name,
        workspaceId: membership.workspaceId,
        members: {
          create: {
            userId: userId,
            role:
              membership.role === WorkspaceRole.OWNER
                ? StoreRole.OWNER
                : StoreRole.ADMIN,
          },
        },
        aiInstructions: {
          create: createDefaultStoreAiInstructions(),
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.store.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string, userId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id,
        members: {
          some: {
            userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store not found or unauthorized');
    }

    return store;
  }

  async findArchivedForUser(userId: string) {
    return this.prisma.store.findMany({
      where: {
        status: StoreStatus.INACTIVE,
        members: { some: { userId } },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, userId: string, updateStoreDto: UpdateStoreDto) {
    if (updateStoreDto.name === undefined) {
      throw new BadRequestException('Güncellenecek mağaza adını girin.');
    }

    const store = await this.prisma.store.findFirst({
      where: {
        id,
        members: {
          some: {
            userId,
            role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
          },
        },
      },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException(
        'Mağaza bulunamadı veya güncelleme yetkiniz yok.',
      );
    }

    return this.prisma.store.update({
      where: { id: store.id },
      data: { name: updateStoreDto.name },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async archive(id: string, userId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id,
        status: StoreStatus.ACTIVE,
        members: {
          some: {
            userId,
            role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
          },
        },
      },
      select: {
        id: true,
        channelConnections: {
          where: {
            OR: [
              { processingStartedAt: { not: null } },
              { questionSyncStartedAt: { not: null } },
            ],
          },
          take: 1,
          select: { id: true },
        },
        questionAnswers: {
          where: { status: QuestionAnswerStatus.PROCESSING },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!store) {
      throw new NotFoundException(
        'Mağaza bulunamadı, zaten arşivlenmiş veya yetkiniz yok.',
      );
    }

    if (
      store.channelConnections.length > 0 ||
      store.questionAnswers.length > 0
    ) {
      throw new ConflictException(
        'Devam eden senkronizasyon veya cevap gönderimi tamamlanmadan mağaza arşivlenemez.',
      );
    }

    await this.prisma.store.update({
      where: { id },
      data: { status: StoreStatus.INACTIVE },
    });

    return {
      archived: true as const,
      archivedStoreId: id,
    };
  }

  async restore(id: string, userId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id,
        status: StoreStatus.INACTIVE,
        members: {
          some: {
            userId,
            role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
          },
        },
      },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException(
        'Arşivlenen mağaza bulunamadı, zaten aktif veya yetkiniz yok.',
      );
    }

    return this.prisma.store.update({
      where: { id },
      data: { status: StoreStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async remove(id: string, userId: string, deleteStoreDto: DeleteStoreDto) {
    const store = await this.prisma.store.findFirst({
      where: {
        id,
        members: {
          some: {
            userId,
            role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
          },
        },
      },
      select: {
        id: true,
        channelConnections: {
          where: {
            OR: [
              { processingStartedAt: { not: null } },
              { questionSyncStartedAt: { not: null } },
            ],
          },
          take: 1,
          select: { id: true },
        },
        questionAnswers: {
          where: { status: QuestionAnswerStatus.PROCESSING },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!store) {
      throw new NotFoundException('Mağaza bulunamadı veya silme yetkiniz yok.');
    }

    if (deleteStoreDto.confirmation !== STORE_DELETE_CONFIRMATION) {
      throw new BadRequestException(
        `Silme onayı birebir "${STORE_DELETE_CONFIRMATION}" olmalıdır.`,
      );
    }

    if (
      store.channelConnections.length > 0 ||
      store.questionAnswers.length > 0
    ) {
      throw new ConflictException(
        'Devam eden senkronizasyon veya cevap gönderimi tamamlanmadan mağaza silinemez.',
      );
    }

    const nextStore = await this.prisma.store.findFirst({
      where: {
        id: { not: id },
        members: { some: { userId } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    await this.prisma.store.delete({ where: { id: store.id } });

    return {
      deleted: true as const,
      deletedStoreId: store.id,
      nextStore,
    };
  }
}
