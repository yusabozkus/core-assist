import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StoreRole, WorkspaceRole } from '../../generated/prisma/enums';
import { CreateStoreDto } from './dto/create-store.dto';
import { PrismaService } from '../../database/prisma.service';

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
}
