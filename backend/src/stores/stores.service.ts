import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CreateStoreDto } from './dto/create-store.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createStoreDto: CreateStoreDto) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: createStoreDto.workspaceId,
          userId,
        },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      throw new UnauthorizedException('You do not have permission to create a store in this workspace');
    }

    return this.prisma.store.create({
      data: {
        name: createStoreDto.name,
        workspaceId: createStoreDto.workspaceId,
        members: {
          create: {
            userId: userId,
            role: 'OWNER',
          },
        },
      },
    });
  }

  async findAllForWorkspace(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new UnauthorizedException('Unauthorized access to workspace');
    }

    return this.prisma.store.findMany({
      where: {
        workspaceId,
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
    });

    if (!store) {
      throw new NotFoundException('Store not found or unauthorized');
    }

    return store;
  }
}
