import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiAutomationMode,
  AiEmojiPolicy,
  AiResponseLength,
  AiTone,
  StoreRole,
  StoreStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import type { UpdateStoreKnowledgeDto } from './dto/update-store-knowledge.dto';

const profileSelect = {
  automationMode: true,
  minimumAutoSendConfidence: true,
  brandDescription: true,
  shippingPolicy: true,
  returnPolicy: true,
  exchangePolicy: true,
  warrantyPolicy: true,
  additionalInformation: true,
  tone: true,
  responseLength: true,
  greetingEnabled: true,
  closingEnabled: true,
  emojiPolicy: true,
  preferredEmoji: true,
  emojiEnabled: true,
} as const;

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(storeId: string, userId: string) {
    await this.requireMembership(storeId, userId);
    return this.read(storeId);
  }

  async update(storeId: string, userId: string, dto: UpdateStoreKnowledgeDto) {
    await this.requireManagement(storeId, userId);

    const providerKeys = [
      ...new Set(dto.channelOverrides?.map((item) => item.providerKey) ?? []),
    ];
    if (providerKeys.length !== (dto.channelOverrides?.length ?? 0)) {
      throw new BadRequestException(
        'Aynı kanal için birden fazla istisna tanımlanamaz.',
      );
    }
    if (
      dto.faqs?.some((faq) => !faq.question.trim() || !faq.answer.trim()) ||
      dto.instructions?.some((instruction) => !instruction.content.trim())
    ) {
      throw new BadRequestException(
        'Soru, cevap ve AI talimatı alanları boş bırakılamaz.',
      );
    }
    if (providerKeys.length > 0) {
      const connectedProviderCount = await this.prisma.channelConnection.count({
        where: { storeId, providerKey: { in: providerKeys } },
      });
      if (connectedProviderCount !== providerKeys.length) {
        throw new NotFoundException(
          'Kanal ayarı yalnızca bu mağazaya bağlı kanallar için oluşturulabilir.',
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.storeKnowledgeProfile.upsert({
        where: { storeId },
        create: {
          storeId,
          automationMode: dto.automationMode ?? AiAutomationMode.OFF,
          minimumAutoSendConfidence: dto.minimumAutoSendConfidence ?? 0.85,
          brandDescription: clean(dto.brandDescription),
          shippingPolicy: clean(dto.shippingPolicy),
          returnPolicy: clean(dto.returnPolicy),
          exchangePolicy: clean(dto.exchangePolicy),
          warrantyPolicy: clean(dto.warrantyPolicy),
          additionalInformation: clean(dto.additionalInformation),
          tone: dto.tone ?? AiTone.PROFESSIONAL,
          responseLength: dto.responseLength ?? AiResponseLength.BALANCED,
          greetingEnabled: dto.greetingEnabled ?? true,
          closingEnabled: dto.closingEnabled ?? true,
          emojiPolicy: dto.emojiPolicy ?? AiEmojiPolicy.NEVER,
          preferredEmoji: clean(dto.preferredEmoji),
          emojiEnabled:
            dto.emojiPolicy !== undefined
              ? dto.emojiPolicy !== AiEmojiPolicy.NEVER
              : false,
        },
        update: {
          automationMode: dto.automationMode,
          minimumAutoSendConfidence: dto.minimumAutoSendConfidence,
          ...(dto.brandDescription !== undefined
            ? { brandDescription: clean(dto.brandDescription) }
            : {}),
          ...(dto.shippingPolicy !== undefined
            ? { shippingPolicy: clean(dto.shippingPolicy) }
            : {}),
          ...(dto.returnPolicy !== undefined
            ? { returnPolicy: clean(dto.returnPolicy) }
            : {}),
          ...(dto.exchangePolicy !== undefined
            ? { exchangePolicy: clean(dto.exchangePolicy) }
            : {}),
          ...(dto.warrantyPolicy !== undefined
            ? { warrantyPolicy: clean(dto.warrantyPolicy) }
            : {}),
          ...(dto.additionalInformation !== undefined
            ? {
                additionalInformation: clean(dto.additionalInformation),
              }
            : {}),
          tone: dto.tone,
          responseLength: dto.responseLength,
          greetingEnabled: dto.greetingEnabled,
          closingEnabled: dto.closingEnabled,
          emojiPolicy: dto.emojiPolicy,
          ...(dto.preferredEmoji !== undefined
            ? { preferredEmoji: clean(dto.preferredEmoji) }
            : {}),
          ...(dto.emojiPolicy !== undefined
            ? { emojiEnabled: dto.emojiPolicy !== AiEmojiPolicy.NEVER }
            : {}),
        },
      });

      if (dto.faqs) {
        await tx.storeKnowledgeFaq.deleteMany({ where: { storeId } });
        if (dto.faqs.length > 0) {
          await tx.storeKnowledgeFaq.createMany({
            data: dto.faqs.map((faq, position) => ({
              storeId,
              question: faq.question.trim(),
              answer: faq.answer.trim(),
              active: faq.active ?? true,
              position,
            })),
          });
        }
      }

      if (dto.instructions) {
        await tx.storeAiInstruction.deleteMany({ where: { storeId } });
        if (dto.instructions.length > 0) {
          await tx.storeAiInstruction.createMany({
            data: dto.instructions.map((instruction, position) => ({
              storeId,
              content: instruction.content.trim(),
              priority: instruction.priority ?? position,
              active: instruction.active ?? true,
            })),
          });
        }
      }

      if (dto.channelOverrides) {
        await tx.channelKnowledgeOverride.deleteMany({ where: { storeId } });
        if (dto.channelOverrides.length > 0) {
          await tx.channelKnowledgeOverride.createMany({
            data: dto.channelOverrides.map((override) => ({
              storeId,
              providerKey: override.providerKey,
              shippingPolicy: clean(override.shippingPolicy),
              returnPolicy: clean(override.returnPolicy),
              exchangePolicy: clean(override.exchangePolicy),
              warrantyPolicy: clean(override.warrantyPolicy),
              additionalInformation: clean(override.additionalInformation),
            })),
          });
        }
      }
    });

    return this.read(storeId);
  }

  private async read(storeId: string) {
    const [profile, faqs, instructions, channelOverrides, connections] =
      await Promise.all([
        this.prisma.storeKnowledgeProfile.findUnique({
          where: { storeId },
          select: profileSelect,
        }),
        this.prisma.storeKnowledgeFaq.findMany({
          where: { storeId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { question: true, answer: true, active: true },
        }),
        this.prisma.storeAiInstruction.findMany({
          where: { storeId },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          select: { content: true, priority: true, active: true },
        }),
        this.prisma.channelKnowledgeOverride.findMany({
          where: { storeId },
          orderBy: { providerKey: 'asc' },
          select: {
            providerKey: true,
            shippingPolicy: true,
            returnPolicy: true,
            exchangePolicy: true,
            warrantyPolicy: true,
            additionalInformation: true,
          },
        }),
        this.prisma.channelConnection.findMany({
          where: { storeId },
          orderBy: { providerKey: 'asc' },
          select: { providerKey: true, status: true },
        }),
      ]);

    const resolvedProfile = profile
      ? {
          ...profile,
          emojiPolicy:
            profile.emojiPolicy === AiEmojiPolicy.NEVER && profile.emojiEnabled
              ? AiEmojiPolicy.ALWAYS
              : profile.emojiPolicy,
        }
      : {
          automationMode: AiAutomationMode.OFF,
          minimumAutoSendConfidence: 0.85,
          brandDescription: null,
          shippingPolicy: null,
          returnPolicy: null,
          exchangePolicy: null,
          warrantyPolicy: null,
          additionalInformation: null,
          tone: AiTone.PROFESSIONAL,
          responseLength: AiResponseLength.BALANCED,
          greetingEnabled: true,
          closingEnabled: true,
          emojiPolicy: AiEmojiPolicy.NEVER,
          preferredEmoji: null,
          emojiEnabled: false,
        };

    const { emojiEnabled: _legacyEmojiEnabled, ...publicProfile } =
      resolvedProfile;
    void _legacyEmojiEnabled;

    return {
      profile: publicProfile,
      faqs,
      instructions,
      channelOverrides,
      providers: connections,
    };
  }

  private async requireMembership(storeId: string, userId: string) {
    const membership = await this.prisma.storeMember.findFirst({
      where: { storeId, userId, store: { status: StoreStatus.ACTIVE } },
      select: { role: true },
    });
    if (!membership) {
      throw new NotFoundException(
        'Mağaza bulunamadı, arşivlenmiş veya erişiminiz yok.',
      );
    }
    return membership;
  }

  private async requireManagement(storeId: string, userId: string) {
    const membership = await this.requireMembership(storeId, userId);
    if (
      membership.role !== StoreRole.OWNER &&
      membership.role !== StoreRole.ADMIN
    ) {
      throw new ForbiddenException(
        'AI bilgi tabanını yönetme yetkiniz bulunmuyor.',
      );
    }
  }
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
