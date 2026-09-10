import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceRole } from '../../generated/prisma/enums';

@Injectable()
export class BillingAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  listWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
                role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
              },
            },
          },
        ],
      },
      select: { id: true, name: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getWorkspaceAccess(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
          { stores: { some: { members: { some: { userId } } } } },
        ],
      },
      select: {
        id: true,
        ownerId: true,
        members: { where: { userId }, select: { role: true } },
      },
    });
    if (!workspace) throw billingForbidden();

    // Store roles never grant workspace-wide financial authority.
    const canManageBilling =
      workspace.ownerId === userId ||
      workspace.members.some(
        (member) =>
          member.role === WorkspaceRole.OWNER ||
          member.role === WorkspaceRole.ADMIN,
      );
    return { workspaceId: workspace.id, canManageBilling };
  }

  async requireWorkspaceAccess(workspaceId: string, userId: string) {
    const access = await this.getWorkspaceAccess(workspaceId, userId);
    if (!access.canManageBilling) throw billingForbidden();
    return { workspaceId: access.workspaceId };
  }
}

function billingForbidden() {
  return new ForbiddenException({
    code: 'BILLING_FORBIDDEN',
    message:
      'Finans işlemleri için çalışma alanı sahibi veya yöneticisi olmalısınız.',
  });
}
