import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const publicProfileSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicProfileSelect,
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { name: dto.name },
    });

    if (result.count === 0) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    return this.getProfile(userId);
  }

  async getAccountOverview(userId: string, currentSessionId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        accounts: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            providerId: true,
            createdAt: true,
          },
        },
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            token: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
          },
        },
        ownedWorkspaces: {
          select: {
            _count: { select: { stores: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    return {
      createdAt: user.createdAt,
      ownedWorkspaceCount: user.ownedWorkspaces.length,
      ownedStoreCount: user.ownedWorkspaces.reduce(
        (total, workspace) => total + workspace._count.stores,
        0,
      ),
      accounts: user.accounts,
      sessions: user.sessions.map((session) => ({
        ...session,
        isCurrent: session.id === currentSessionId,
      })),
    };
  }

  async exportAccountData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        onboardingCompletedAt: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          select: {
            id: true,
            providerId: true,
            accountId: true,
            issuer: true,
            scope: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        sessions: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
          },
        },
        workspaceMembers: {
          select: {
            role: true,
            createdAt: true,
            workspace: {
              select: { id: true, name: true, ownerId: true },
            },
          },
        },
        ownedWorkspaces: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            stores: {
              select: {
                id: true,
                name: true,
                timezone: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                knowledgeProfile: true,
                knowledgeFaqs: true,
                aiInstructions: true,
                channelKnowledge: true,
                channelConnections: {
                  select: {
                    id: true,
                    providerKey: true,
                    type: true,
                    environment: true,
                    status: true,
                    connectedAt: true,
                    lastSyncAt: true,
                    lastInventorySyncAt: true,
                    lastQuestionSyncAt: true,
                    failureReason: true,
                    questionSyncFailureReason: true,
                    removedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    syncRuns: true,
                  },
                },
                products: {
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    brand: true,
                    category: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    identities: true,
                    variants: true,
                    attributes: true,
                    images: true,
                    sizeGuides: true,
                    externalProducts: {
                      select: {
                        id: true,
                        connectionId: true,
                        productId: true,
                        externalId: true,
                        externalUrl: true,
                        status: true,
                        sourceUpdatedAt: true,
                        lastSyncedAt: true,
                        createdAt: true,
                        updatedAt: true,
                        variants: true,
                      },
                    },
                  },
                },
                productQuestions: {
                  select: {
                    id: true,
                    connectionId: true,
                    productId: true,
                    externalQuestionId: true,
                    externalProductId: true,
                    externalCustomerId: true,
                    customerName: true,
                    productTitleSnapshot: true,
                    productImageUrlSnapshot: true,
                    question: true,
                    status: true,
                    answer: true,
                    draftDecision: true,
                    draftConfidence: true,
                    draftAnswerability: true,
                    draftRisks: true,
                    draftMissingInformation: true,
                    draftEvidenceIds: true,
                    draftModel: true,
                    draftedAt: true,
                    externalCreatedAt: true,
                    answeredAt: true,
                    createdAt: true,
                    updatedAt: true,
                    draftAttempts: {
                      select: {
                        id: true,
                        trigger: true,
                        outcome: true,
                        answer: true,
                        decision: true,
                        confidence: true,
                        answerability: true,
                        risks: true,
                        missingInformation: true,
                        evidenceIds: true,
                        model: true,
                        interpretation: true,
                        automationMode: true,
                        autoSendEligible: true,
                        createdAt: true,
                      },
                    },
                    answerDelivery: {
                      select: {
                        id: true,
                        origin: true,
                        composition: true,
                        answer: true,
                        status: true,
                        externalAnswerId: true,
                        attempts: true,
                        lastError: true,
                        queuedAt: true,
                        processingStartedAt: true,
                        sentAt: true,
                        createdAt: true,
                        updatedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    return {
      schemaVersion: 1,
      exportedAt: new Date(),
      notice:
        'OAuth erişim anahtarları, oturum anahtarları ve pazaryeri kimlik bilgileri güvenlik nedeniyle dışa aktarıma dahil edilmemiştir.',
      user,
    };
  }
}
