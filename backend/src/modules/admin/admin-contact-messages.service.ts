import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { ContactMessageStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';
import { AdminContactMessagesQueryDto } from './dto/admin-contact-messages-query.dto';

@Injectable()
export class AdminContactMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: AdminContactMessagesQueryDto) {
    const where = this.buildWhere(query);
    const [items, total, fresh, read, archived] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: contactMessageSelect,
      }),
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.count({
        where: { status: ContactMessageStatus.NEW },
      }),
      this.prisma.contactMessage.count({
        where: { status: ContactMessageStatus.READ },
      }),
      this.prisma.contactMessage.count({
        where: { status: ContactMessageStatus.ARCHIVED },
      }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      summary: { new: fresh, read, archived },
    };
  }

  async findOne(messageId: string) {
    const message = await this.prisma.contactMessage.findUnique({
      where: { id: messageId },
      select: contactMessageSelect,
    });
    if (!message) throw new NotFoundException('İletişim mesajı bulunamadı.');
    return message;
  }

  async updateStatus(
    messageId: string,
    status: ContactMessageStatus,
    adminUserId: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.contactMessage.findUnique({
        where: { id: messageId },
        select: { id: true, status: true, readAt: true },
      });
      if (!current) throw new NotFoundException('İletişim mesajı bulunamadı.');

      const now = new Date();
      const updated = await transaction.contactMessage.update({
        where: { id: messageId },
        data: {
          status,
          readAt:
            status === ContactMessageStatus.NEW
              ? null
              : (current.readAt ?? now),
          archivedAt: status === ContactMessageStatus.ARCHIVED ? now : null,
        },
        select: contactMessageSelect,
      });

      await this.audit.record(
        {
          actorType: AuditActorType.ADMIN,
          actorUserId: adminUserId,
          origin: AuditOrigin.API,
          action: AuditAction.ADMIN_CONTACT_MESSAGE_STATUS_CHANGED,
          result: AuditResult.SUCCESS,
          targetType: 'CONTACT_MESSAGE',
          targetId: messageId,
          before: { status: current.status },
          after: { status },
        },
        transaction,
      );

      return updated;
    });
  }

  private buildWhere(
    query: AdminContactMessagesQueryDto,
  ): Prisma.ContactMessageWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.topic ? { topic: query.topic } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { company: { contains: query.q, mode: 'insensitive' } },
              { subject: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
}

const contactMessageSelect = {
  id: true,
  name: true,
  email: true,
  company: true,
  topic: true,
  subject: true,
  message: true,
  status: true,
  sourcePage: true,
  readAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactMessageSelect;
