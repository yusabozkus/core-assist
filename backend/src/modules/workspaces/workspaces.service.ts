import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  getOrCreateOwnedWorkspace(userId: string, name?: string) {
    return this.prisma.$transaction((transaction) =>
      this.getOrCreateOwnedWorkspaceInTransaction(transaction, userId, name),
    );
  }

  async getOrCreateOwnedWorkspaceInTransaction(
    transaction: Prisma.TransactionClient,
    userId: string,
    name?: string,
  ) {
    // All creation paths use this lock, including onboarding and billing.
    // Keep it until the caller commits any dependent store/setup changes.
    const [owner] = await transaction.$queryRaw<
      Array<{ id: string; name: string }>
    >`SELECT "id", "name" FROM "user" WHERE "id" = ${userId} FOR UPDATE`;
    if (!owner) throw new NotFoundException('Kullanıcı bulunamadı.');

    const existing = await transaction.workspace.findUnique({
      where: { ownerId: userId },
    });
    if (existing) return existing;

    // Provisioning an internal workspace never resets billing or onboarding.
    return transaction.workspace.create({
      data: {
        name: (name?.trim() || owner.name.trim() || 'CoreAssist').slice(0, 80),
        ownerId: userId,
        members: {
          create: {
            userId,
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
