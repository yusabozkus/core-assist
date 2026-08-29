import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createWorkspaceDto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        name: createWorkspaceDto.name,
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: WorkspaceRole.OWNER,
          },
        },
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: userId,
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
        },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id,
        members: {
          some: {
            userId: userId,
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
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found or unauthorized');
    }
    return workspace;
  }
}
