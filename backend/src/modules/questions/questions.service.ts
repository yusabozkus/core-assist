import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ChannelConnectionStatus,
  ChannelType,
  StoreRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { QUESTION_SYNC_DISPATCHER } from '../question-sync/question-sync.constants';
import type { QuestionSyncDispatcher } from '../question-sync/question-sync.types';

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUESTION_SYNC_DISPATCHER)
    private readonly questionSync: QuestionSyncDispatcher,
  ) {}

  async findAll(storeId: string, userId: string) {
    await this.requireStoreMembership(storeId, userId);

    return this.prisma.productQuestion.findMany({
      where: { storeId },
      orderBy: { externalCreatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        externalQuestionId: true,
        externalProductId: true,
        customerName: true,
        question: true,
        status: true,
        externalCreatedAt: true,
        createdAt: true,
        connection: {
          select: { providerKey: true },
        },
        product: {
          select: {
            id: true,
            title: true,
            brand: true,
            category: true,
            images: {
              orderBy: { position: 'asc' },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    });
  }

  async sync(storeId: string, userId: string) {
    const membership = await this.requireStoreMembership(storeId, userId);

    if (
      membership.role !== StoreRole.OWNER &&
      membership.role !== StoreRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Ürün sorularını senkronize etme yetkiniz bulunmuyor.',
      );
    }

    const connections = await this.prisma.channelConnection.findMany({
      where: {
        storeId,
        type: ChannelType.COMMERCE,
        status: ChannelConnectionStatus.CONNECTED,
        credentialsEncrypted: { not: null },
      },
      select: { id: true },
    });
    const results = await Promise.allSettled(
      connections.map((connection) =>
        this.questionSync.enqueue(storeId, connection.id),
      ),
    );
    const unexpectedFailure = results.find(
      (result) =>
        result.status === 'rejected' &&
        !(result.reason instanceof ConflictException),
    );

    if (unexpectedFailure?.status === 'rejected') {
      throw unexpectedFailure.reason;
    }

    return {
      status: 'RUNNING' as const,
      queued: results.filter((result) => result.status === 'fulfilled').length,
      skipped: results.filter((result) => result.status === 'rejected').length,
    };
  }

  private async requireStoreMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }

    return membership;
  }
}
