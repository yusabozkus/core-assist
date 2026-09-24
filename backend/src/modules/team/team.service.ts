import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import {
  NotificationSeverity,
  NotificationType,
  StoreRole,
  StoreStatus,
  WorkspaceInvitationStatus,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BillingEntitlementService } from '../billing/billing-entitlement.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateWorkspaceInvitationDto,
  TeamAccessLevel,
  UpdateWorkspaceMemberDto,
} from './dto/team-member-access.dto';
import { resolveTeamAccessLevel } from './team-access';
import { AuditAction } from '../audit/audit-actions';
import { TeamInvitationEmailService } from './team-invitation-email.service';
import { TeamEventEmailService } from './team-event-email.service';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1_000;

const invitationInclude = {
  workspace: { select: { id: true, name: true, ownerId: true } },
  invitedBy: { select: { id: true, name: true } },
  storeAccesses: {
    include: { store: { select: { id: true, name: true, status: true } } },
    orderBy: { store: { createdAt: 'asc' as const } },
  },
} satisfies Prisma.WorkspaceInvitationInclude;

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingEntitlements: BillingEntitlementService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditLogService,
    private readonly invitationEmail: TeamInvitationEmailService,
    private readonly teamEventEmail: TeamEventEmailService,
  ) {}

  async getTeam(workspaceId: string, actorUserId: string) {
    await this.requireManager(this.prisma, workspaceId, actorUserId);
    const now = new Date();
    const [workspace, summary] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          ownerId: true,
          stores: {
            where: { status: StoreStatus.ACTIVE },
            orderBy: { createdAt: 'asc' },
            select: { id: true, name: true, status: true },
          },
          members: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          invitations: {
            where: {
              status: WorkspaceInvitationStatus.PENDING,
              expiresAt: { gt: now },
            },
            orderBy: { createdAt: 'desc' },
            include: invitationInclude,
          },
        },
      }),
      this.billingEntitlements.getSummaryForWorkspace(workspaceId, now),
    ]);
    if (!workspace) throw new NotFoundException('Çalışma alanı bulunamadı.');

    const storeMemberships = await this.prisma.storeMember.findMany({
      where: { store: { workspaceId } },
      select: {
        userId: true,
        role: true,
        store: { select: { id: true, name: true } },
      },
      orderBy: { store: { createdAt: 'asc' } },
    });
    const deliveryKeys = workspace.invitations.map((invitation) =>
      this.invitationEmail.deliveryKey(invitation),
    );
    const deliveries = deliveryKeys.length
      ? await this.prisma.emailDeliveryRecord.findMany({
          where: { deliveryKey: { in: deliveryKeys } },
          select: { deliveryKey: true, status: true },
        })
      : [];
    const deliveryStatuses = new Map(
      deliveries.map((delivery) => [delivery.deliveryKey, delivery.status]),
    );

    return {
      workspace: { id: workspace.id, name: workspace.name },
      canInviteAccountAdmins:
        workspace.members.find((member) => member.userId === actorUserId)
          ?.role === WorkspaceRole.OWNER,
      capacity: summary.usage.members,
      stores: workspace.stores,
      members: workspace.members.map((member) => {
        const accesses = storeMemberships.filter(
          (storeMembership) => storeMembership.userId === member.userId,
        );
        return {
          user: member.user,
          workspaceRole: member.role,
          accessLevel: resolveTeamAccessLevel(member.role, accesses),
          stores:
            member.role === WorkspaceRole.OWNER ||
            member.role === WorkspaceRole.ADMIN
              ? workspace.stores
              : accesses.map((access) => access.store),
          joinedAt: member.createdAt,
          isOwner: workspace.ownerId === member.userId,
        };
      }),
      invitations: workspace.invitations.map((invitation) => ({
        ...serializeInvitation(invitation),
        emailDelivery: this.invitationEmail.status(
          deliveryStatuses.get(this.invitationEmail.deliveryKey(invitation)),
        ),
      })),
    };
  }

  async createInvitation(
    workspaceId: string,
    actorUserId: string,
    dto: CreateWorkspaceInvitationDto,
  ) {
    const emailNormalized = normalizeEmail(dto.email);
    const { token, tokenHash } = createInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

    const result = await this.prisma.$transaction(async (transaction) => {
      const actor = await this.requireManager(
        transaction,
        workspaceId,
        actorUserId,
      );
      this.assertActorCanAssign(actor.role, dto.accessLevel);
      await this.lockWorkspace(transaction, workspaceId);
      await this.expireInvitations(transaction, workspaceId);
      await this.assertEmailCanJoin(transaction, workspaceId, emailNormalized);

      const storeAccesses = await this.resolveStoreAccesses(
        transaction,
        workspaceId,
        dto.accessLevel,
        dto.storeIds,
      );
      const existing = await transaction.workspaceInvitation.findFirst({
        where: {
          workspaceId,
          emailNormalized,
          status: WorkspaceInvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!existing) {
        await this.billingEntitlements.assertMemberCapacityInTransaction(
          transaction,
          workspaceId,
        );
      }

      const savedInvitation = existing
        ? await transaction.workspaceInvitation.update({
            where: { id: existing.id },
            data: {
              email: dto.email.trim(),
              role: workspaceRoleFor(dto.accessLevel),
              tokenHash,
              invitedByUserId: actorUserId,
              expiresAt,
              acceptedAt: null,
              revokedAt: null,
              storeAccesses: {
                deleteMany: {},
                create: storeAccesses,
              },
            },
            include: invitationInclude,
          })
        : await transaction.workspaceInvitation.create({
            data: {
              workspaceId,
              email: dto.email.trim(),
              emailNormalized,
              role: workspaceRoleFor(dto.accessLevel),
              tokenHash,
              invitedByUserId: actorUserId,
              expiresAt,
              storeAccesses: { create: storeAccesses },
            },
            include: invitationInclude,
          });

      if (existing) {
        await this.invitationEmail.cancelPending(transaction, existing.id);
      }
      const deliveryKey = await this.invitationEmail.stage(
        transaction,
        savedInvitation,
        token,
        dto.accessLevel,
      );

      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId,
          origin: AuditOrigin.API,
          action: AuditAction.TEAM_INVITATION_CREATED,
          result: AuditResult.SUCCESS,
          workspaceId,
          targetType: 'WORKSPACE_INVITATION',
          targetId: savedInvitation.id,
          after: {
            role: savedInvitation.role,
            expiresAt: savedInvitation.expiresAt,
            storeIds: savedInvitation.storeAccesses.map(
              (access) => access.storeId,
            ),
          },
          metadata: {
            accessLevel: dto.accessLevel,
            replacedPendingInvitation: Boolean(existing),
            inviteeReference: hashAuditReference(emailNormalized),
          },
        },
        transaction,
      );

      return { invitation: savedInvitation, deliveryKey };
    });

    const emailDelivery = await this.invitationEmail.deliver(
      result.deliveryKey,
    );
    return {
      ...invitationWithLink(result.invitation, token),
      invitation: {
        ...serializeInvitation(result.invitation),
        emailDelivery,
      },
      emailDelivery,
    };
  }

  async renewInvitationLink(
    workspaceId: string,
    invitationId: string,
    actorUserId: string,
  ) {
    const { token, tokenHash } = createInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
    const result = await this.prisma.$transaction(async (transaction) => {
      await this.requireManager(transaction, workspaceId, actorUserId);
      await this.lockWorkspace(transaction, workspaceId);
      const existing = await transaction.workspaceInvitation.findFirst({
        where: {
          id: invitationId,
          workspaceId,
          status: WorkspaceInvitationStatus.PENDING,
        },
        include: invitationInclude,
      });
      if (!existing) throw new NotFoundException('Bekleyen davet bulunamadı.');

      if (existing.expiresAt <= new Date()) {
        await this.billingEntitlements.assertMemberCapacityInTransaction(
          transaction,
          workspaceId,
          { excludeInvitationId: existing.id },
        );
      }

      const renewed = await transaction.workspaceInvitation.update({
        where: { id: existing.id },
        data: { tokenHash, expiresAt },
        include: invitationInclude,
      });
      await this.invitationEmail.cancelPending(transaction, existing.id);
      const accessLevel = accessLevelForInvitation(renewed);
      if (accessLevel === 'OWNER') {
        throw new ConflictException('Hesap sahibine davet oluşturulamaz.');
      }
      const deliveryKey = await this.invitationEmail.stage(
        transaction,
        renewed,
        token,
        accessLevel,
      );
      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId,
          origin: AuditOrigin.API,
          action: AuditAction.TEAM_INVITATION_LINK_RENEWED,
          result: AuditResult.SUCCESS,
          workspaceId,
          targetType: 'WORKSPACE_INVITATION',
          targetId: invitationId,
          before: { expiresAt: existing.expiresAt },
          after: { expiresAt: renewed.expiresAt },
        },
        transaction,
      );
      return { invitation: renewed, deliveryKey };
    });

    const emailDelivery = await this.invitationEmail.deliver(
      result.deliveryKey,
    );
    return {
      ...invitationWithLink(result.invitation, token),
      invitation: {
        ...serializeInvitation(result.invitation),
        emailDelivery,
      },
      emailDelivery,
    };
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.requireManager(transaction, workspaceId, actorUserId);
      const invitation = await transaction.workspaceInvitation.findFirst({
        where: {
          id: invitationId,
          workspaceId,
          status: WorkspaceInvitationStatus.PENDING,
        },
        select: { id: true, role: true, expiresAt: true },
      });
      if (!invitation)
        throw new NotFoundException('Bekleyen davet bulunamadı.');

      await transaction.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: WorkspaceInvitationStatus.REVOKED,
          revokedAt: new Date(),
        },
      });
      await this.invitationEmail.cancelPending(transaction, invitation.id);
      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId,
          origin: AuditOrigin.API,
          action: AuditAction.TEAM_INVITATION_REVOKED,
          result: AuditResult.SUCCESS,
          workspaceId,
          targetType: 'WORKSPACE_INVITATION',
          targetId: invitationId,
          before: {
            status: WorkspaceInvitationStatus.PENDING,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
          },
          after: { status: WorkspaceInvitationStatus.REVOKED },
        },
        transaction,
      );
      return { revoked: true, invitationId };
    });
  }

  async updateMember(
    workspaceId: string,
    targetUserId: string,
    actorUserId: string,
    dto: UpdateWorkspaceMemberDto,
  ) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const actor = await this.requireManager(
        transaction,
        workspaceId,
        actorUserId,
      );
      if (targetUserId === actorUserId) {
        throw new BadRequestException(
          'Kendi ekip yetkinizi değiştiremezsiniz.',
        );
      }
      const target = await this.requireEditableMember(
        transaction,
        workspaceId,
        targetUserId,
        actor.role,
      );
      this.assertActorCanAssign(actor.role, dto.accessLevel);
      const storeAccesses = await this.resolveStoreAccesses(
        transaction,
        workspaceId,
        dto.accessLevel,
        dto.storeIds,
      );
      const previousStoreAccesses = await transaction.storeMember.findMany({
        where: { userId: targetUserId, store: { workspaceId } },
        select: { storeId: true, role: true },
        orderBy: { storeId: 'asc' },
      });

      const previousAccess = previousStoreAccesses
        .map((access) => `${access.storeId}:${access.role}`)
        .sort();
      const nextAccess = storeAccesses
        .map((access) => `${access.storeId}:${access.role}`)
        .sort();
      if (
        target.role === workspaceRoleFor(dto.accessLevel) &&
        previousAccess.length === nextAccess.length &&
        previousAccess.every((access, index) => access === nextAccess[index])
      ) {
        return {
          response: { updated: false, userId: targetUserId },
          notificationRecipientIds: [],
          emailKeys: [],
        };
      }

      await transaction.storeMember.deleteMany({
        where: { userId: targetUserId, store: { workspaceId } },
      });
      const updatedMember = await transaction.workspaceMember.update({
        where: { id: target.id },
        data: { role: workspaceRoleFor(dto.accessLevel) },
      });
      if (storeAccesses.length) {
        await transaction.storeMember.createMany({
          data: storeAccesses.map((access) => ({
            storeId: access.storeId,
            userId: targetUserId,
            role: access.role,
          })),
          skipDuplicates: true,
        });
      }
      const notificationRecipientIds =
        await this.notifications.createForUsersInTransaction(transaction, {
          recipientUserIds: [targetUserId],
          type: NotificationType.TEAM_ACCESS_CHANGED,
          severity: NotificationSeverity.INFO,
          title: 'Ekip erişiminiz güncellendi',
          message:
            'Çalışma alanındaki rolünüz veya erişebildiğiniz mağazalar bir yönetici tarafından değiştirildi.',
          actionUrl: '/dashboard',
          entityType: 'WORKSPACE_MEMBER',
          entityId: target.id,
          dedupeKey: `team-access-changed:${target.id}:${updatedMember.updatedAt.toISOString()}`,
        });
      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId,
          origin: AuditOrigin.API,
          action: AuditAction.TEAM_MEMBER_ACCESS_CHANGED,
          result: AuditResult.SUCCESS,
          workspaceId,
          targetType: 'WORKSPACE_MEMBER',
          targetId: target.id,
          before: {
            userId: targetUserId,
            role: target.role,
            storeAccesses: previousStoreAccesses,
          },
          after: {
            userId: targetUserId,
            role: updatedMember.role,
            storeAccesses,
          },
        },
        transaction,
      );
      const emailKeys = await this.teamEventEmail.stage(transaction, {
        workspaceId,
        recipientUserIds: [targetUserId],
        eventKey: `access-changed:${target.id}:${randomUUID()}`,
        event: {
          kind: 'ACCESS_CHANGED',
          accessLevel: dto.accessLevel,
          storeIds: storeAccesses.map((access) => access.storeId),
        },
      });
      return {
        response: { updated: true, userId: targetUserId },
        notificationRecipientIds,
        emailKeys,
      };
    });
    this.notifications.emitChange(result.notificationRecipientIds, null);
    await this.teamEventEmail.deliver(result.emailKeys);
    return result.response;
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    actorUserId: string,
  ) {
    const result = await this.prisma.$transaction(async (transaction) => {
      const actor = await this.requireManager(
        transaction,
        workspaceId,
        actorUserId,
      );
      if (targetUserId === actorUserId) {
        throw new BadRequestException('Kendinizi ekipten çıkaramazsınız.');
      }
      const target = await this.requireEditableMember(
        transaction,
        workspaceId,
        targetUserId,
        actor.role,
      );
      await transaction.storeMember.deleteMany({
        where: { userId: targetUserId, store: { workspaceId } },
      });
      await transaction.workspaceMember.delete({ where: { id: target.id } });
      await this.audit.record(
        {
          actorType: AuditActorType.USER,
          actorUserId,
          origin: AuditOrigin.API,
          action: AuditAction.TEAM_MEMBER_REMOVED,
          result: AuditResult.SUCCESS,
          workspaceId,
          targetType: 'WORKSPACE_MEMBER',
          targetId: target.id,
          before: { userId: targetUserId, role: target.role },
          after: { removed: true },
        },
        transaction,
      );
      const emailKeys = await this.teamEventEmail.stage(transaction, {
        workspaceId,
        recipientUserIds: [targetUserId],
        eventKey: `member-removed:${target.id}`,
        event: { kind: 'REMOVED' },
      });
      return { response: { removed: true, userId: targetUserId }, emailKeys };
    });
    await this.teamEventEmail.deliver(result.emailKeys);
    return result.response;
  }

  async getInvitation(token: string) {
    const invitation = await this.findInvitation(token);
    return {
      status:
        invitation.status === WorkspaceInvitationStatus.PENDING &&
        invitation.expiresAt <= new Date()
          ? WorkspaceInvitationStatus.EXPIRED
          : invitation.status,
      workspaceName: invitation.workspace.name,
      invitedByName: invitation.invitedBy?.name ?? null,
      email: maskEmail(invitation.email),
      accessLevel: accessLevelForInvitation(invitation),
      stores: invitation.storeAccesses.map((access) => access.store),
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(
    token: string,
    user: { id: string; name: string; email: string; emailVerified: boolean },
  ) {
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Davet için doğrulanmış bir e-posta gerekir.',
      );
    }
    const tokenHash = hashToken(token);
    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "workspace_invitation"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `;
        if (!locked[0])
          throw new NotFoundException('Davet bağlantısı geçersiz.');

        const invitation = await transaction.workspaceInvitation.findUnique({
          where: { id: locked[0].id },
          include: invitationInclude,
        });
        if (!invitation)
          throw new NotFoundException('Davet bağlantısı geçersiz.');
        if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
          throw new ConflictException('Bu davet artık kullanılamıyor.');
        }
        if (invitation.expiresAt <= new Date()) {
          throw new GoneException('Bu davetin süresi dolmuş.');
        }
        if (normalizeEmail(user.email) !== invitation.emailNormalized) {
          throw new ForbiddenException(
            'Bu davet farklı bir e-posta adresi için oluşturulmuş.',
          );
        }

        const memberships = await transaction.workspaceMember.findMany({
          where: { userId: user.id },
          select: { id: true, workspaceId: true },
        });
        const otherWorkspace = memberships.find(
          (membership) => membership.workspaceId !== invitation.workspaceId,
        );
        if (otherWorkspace) {
          throw new ConflictException(
            'Bu hesap başka bir Core Asistan ekibine bağlı. Bir hesap yalnızca bir ekibe katılabilir.',
          );
        }
        const currentMembership = memberships.find(
          (membership) => membership.workspaceId === invitation.workspaceId,
        );
        if (!currentMembership) {
          await this.billingEntitlements.assertMemberCapacityInTransaction(
            transaction,
            invitation.workspaceId,
            { excludeInvitationId: invitation.id },
          );
          await transaction.workspaceMember.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId: user.id,
              role: invitation.role,
            },
          });

          const accesses =
            invitation.role === WorkspaceRole.ADMIN
              ? await this.allStoreAccesses(transaction, invitation.workspaceId)
              : invitation.storeAccesses.map((access) => ({
                  storeId: access.storeId,
                  role: access.role,
                }));
          if (accesses.length) {
            await transaction.storeMember.createMany({
              data: accesses.map((access) => ({
                storeId: access.storeId,
                userId: user.id,
                role: access.role,
              })),
              skipDuplicates: true,
            });
          }
        }

        const acceptedAt = new Date();
        await Promise.all([
          transaction.workspaceInvitation.update({
            where: { id: invitation.id },
            data: {
              status: WorkspaceInvitationStatus.ACCEPTED,
              acceptedAt,
            },
          }),
          transaction.user.update({
            where: { id: user.id },
            data: { onboardingCompletedAt: acceptedAt },
          }),
        ]);
        await this.invitationEmail.cancelPending(transaction, invitation.id);

        const candidateRecipientIds = [
          ...new Set(
            [invitation.workspace.ownerId, invitation.invitedByUserId].filter(
              (recipientUserId): recipientUserId is string =>
                Boolean(recipientUserId) && recipientUserId !== user.id,
            ),
          ),
        ];
        const managerMemberships = await transaction.workspaceMember.findMany({
          where: {
            workspaceId: invitation.workspaceId,
            userId: { in: candidateRecipientIds },
            role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
          },
          select: { userId: true },
        });
        const managerRecipientIds = managerMemberships.map(
          (member) => member.userId,
        );
        const notificationRecipientIds =
          await this.notifications.createForUsersInTransaction(transaction, {
            recipientUserIds: managerRecipientIds,
            type: NotificationType.TEAM_INVITATION_ACCEPTED,
            severity: NotificationSeverity.INFO,
            title: 'Ekip daveti kabul edildi',
            message: `${user.name}, ${invitation.workspace.name} ekibine katıldı.`,
            actionUrl: '/dashboard/team',
            entityType: 'WORKSPACE_INVITATION',
            entityId: invitation.id,
            dedupeKey: `team-invitation-accepted:${invitation.id}`,
          });

        await this.audit.record(
          {
            actorType: AuditActorType.USER,
            actorUserId: user.id,
            origin: AuditOrigin.API,
            action: AuditAction.TEAM_INVITATION_ACCEPTED,
            result: AuditResult.SUCCESS,
            workspaceId: invitation.workspaceId,
            targetType: 'WORKSPACE_INVITATION',
            targetId: invitation.id,
            before: { status: invitation.status },
            after: {
              status: WorkspaceInvitationStatus.ACCEPTED,
              userId: user.id,
              role: invitation.role,
              storeIds: invitation.storeAccesses.map(
                (access) => access.storeId,
              ),
            },
          },
          transaction,
        );

        const emailKeys = await this.teamEventEmail.stage(transaction, {
          workspaceId: invitation.workspaceId,
          recipientUserIds: managerRecipientIds,
          eventKey: `invitation-accepted:${invitation.id}`,
          event: { kind: 'ACCEPTED', memberName: user.name },
        });

        return {
          response: {
            accepted: true,
            workspace: {
              id: invitation.workspaceId,
              name: invitation.workspace.name,
            },
            nextPath: '/dashboard',
          },
          notificationRecipientIds,
          emailKeys,
        };
      });
      this.notifications.emitChange(result.notificationRecipientIds, null);
      await this.teamEventEmail.deliver(result.emailKeys);
      return result.response;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'Bu hesap başka bir Core Asistan ekibine aynı anda katıldı. Davet kabul edilmedi.',
        );
      }
      throw error;
    }
  }

  private async findInvitation(token: string) {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
      throw new NotFoundException('Davet bağlantısı geçersiz.');
    }
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        workspace: { select: { name: true } },
        invitedBy: { select: { name: true } },
        storeAccesses: {
          include: { store: { select: { id: true, name: true } } },
          orderBy: { store: { createdAt: 'asc' } },
        },
      },
    });
    if (!invitation) throw new NotFoundException('Davet bağlantısı geçersiz.');
    return invitation;
  }

  private async requireManager(
    transaction: Prisma.TransactionClient | PrismaService,
    workspaceId: string,
    userId: string,
  ) {
    const membership = await transaction.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true, role: true },
    });
    if (
      !membership ||
      (membership.role !== WorkspaceRole.OWNER &&
        membership.role !== WorkspaceRole.ADMIN)
    ) {
      throw new ForbiddenException('Ekip yönetimi yetkiniz bulunmuyor.');
    }
    return membership;
  }

  private async requireEditableMember(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    targetUserId: string,
    actorRole: WorkspaceRole,
  ) {
    const target = await transaction.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('Ekip üyesi bulunamadı.');
    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Hesap sahibi ekipten çıkarılamaz.');
    }
    if (
      actorRole !== WorkspaceRole.OWNER &&
      target.role === WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Yöneticilerin yetkisini yalnızca hesap sahibi değiştirebilir.',
      );
    }
    return target;
  }

  private assertActorCanAssign(
    actorRole: WorkspaceRole,
    accessLevel: TeamAccessLevel,
  ) {
    if (
      accessLevel === TeamAccessLevel.ACCOUNT_ADMIN &&
      actorRole !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException(
        'Hesap yöneticisi yetkisini yalnızca hesap sahibi verebilir.',
      );
    }
  }

  private async resolveStoreAccesses(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    accessLevel: TeamAccessLevel,
    requestedStoreIds: string[] | undefined,
  ) {
    if (accessLevel === TeamAccessLevel.ACCOUNT_ADMIN) {
      return this.allStoreAccesses(transaction, workspaceId);
    }
    const storeIds = [...new Set(requestedStoreIds ?? [])];
    if (!storeIds.length) {
      throw new BadRequestException('En az bir mağaza seçmelisiniz.');
    }
    const stores = await transaction.store.findMany({
      where: {
        id: { in: storeIds },
        workspaceId,
        status: StoreStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (stores.length !== storeIds.length) {
      throw new BadRequestException(
        'Seçilen mağazalardan biri kullanılamıyor.',
      );
    }
    const role = storeRoleFor(accessLevel);
    return stores.map((store) => ({ storeId: store.id, role }));
  }

  private async allStoreAccesses(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const stores = await transaction.store.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    return stores.map((store) => ({
      storeId: store.id,
      role: StoreRole.ADMIN,
    }));
  }

  private async assertEmailCanJoin(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    emailNormalized: string,
  ) {
    const user = await transaction.user.findFirst({
      where: { email: { equals: emailNormalized, mode: 'insensitive' } },
      select: {
        id: true,
        workspaceMembers: { select: { workspaceId: true } },
      },
    });
    if (!user) return;
    if (
      user.workspaceMembers.some(
        (membership) => membership.workspaceId === workspaceId,
      )
    ) {
      throw new ConflictException('Bu kullanıcı zaten ekibinizde.');
    }
    if (user.workspaceMembers.length) {
      throw new ConflictException(
        'Bu kullanıcı başka bir Core Asistan ekibine bağlı.',
      );
    }
  }

  private expireInvitations(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    return transaction.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        status: WorkspaceInvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: WorkspaceInvitationStatus.EXPIRED },
    });
  }

  private async lockWorkspace(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "workspace" WHERE "id" = ${workspaceId} FOR UPDATE
    `;
    if (!locked[0]) throw new NotFoundException('Çalışma alanı bulunamadı.');
  }
}

function workspaceRoleFor(accessLevel: TeamAccessLevel) {
  return accessLevel === TeamAccessLevel.ACCOUNT_ADMIN
    ? WorkspaceRole.ADMIN
    : WorkspaceRole.MEMBER;
}

function storeRoleFor(accessLevel: TeamAccessLevel) {
  if (accessLevel === TeamAccessLevel.STORE_ADMIN) return StoreRole.ADMIN;
  if (accessLevel === TeamAccessLevel.VIEWER) return StoreRole.VIEWER;
  return StoreRole.AGENT;
}

function accessLevelForInvitation(invitation: {
  role: WorkspaceRole;
  storeAccesses: Array<{ role: StoreRole }>;
}) {
  return resolveTeamAccessLevel(invitation.role, invitation.storeAccesses);
}

function serializeInvitation<
  T extends Prisma.WorkspaceInvitationGetPayload<{
    include: typeof invitationInclude;
  }>,
>(invitation: T) {
  return {
    id: invitation.id,
    email: invitation.email,
    accessLevel: accessLevelForInvitation(invitation),
    stores: invitation.storeAccesses.map((access) => access.store),
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

function invitationWithLink<
  T extends Prisma.WorkspaceInvitationGetPayload<{
    include: typeof invitationInclude;
  }>,
>(invitation: T, token: string) {
  return {
    invitation: serializeInvitation(invitation),
    acceptPath: `/invite/${token}`,
  };
}

function createInvitationToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function hashAuditReference(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
