import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StoreStatus } from '../../generated/prisma/enums';
import { UpdateSetupGuideDto } from './dto/update-setup-guide.dto';

type Phase = 'ESSENTIAL' | 'OPTIONAL' | 'DONE';

@Injectable()
export class SetupGuideService {
  constructor(private readonly prisma: PrismaService) {}

  async get(storeId: string, userId: string) {
    const member = await this.requireMember(storeId, userId);
    return this.toResponse(member);
  }

  async update(storeId: string, userId: string, dto: UpdateSetupGuideDto) {
    const member = await this.requireMember(storeId, userId);
    const id = member.id;
    const now = new Date();

    if (
      dto.action === 'VISIT_AI' ||
      (dto.action === 'IMPORT_LEGACY' && dto.aiSettingsVisited)
    ) {
      await this.prisma.storeMember.updateMany({
        where: { id, setupGuideAiSettingsVisitedAt: null },
        data: { setupGuideAiSettingsVisitedAt: now },
      });
    }
    if (dto.action === 'VISIT_CHANNELS') {
      await this.prisma.storeMember.updateMany({
        where: { id, setupGuideChannelsVisitedAt: null },
        data: { setupGuideChannelsVisitedAt: now },
      });
    }
    if (dto.action === 'VISIT_TEAM') {
      await this.prisma.storeMember.updateMany({
        where: { id, setupGuideTeamVisitedAt: null },
        data: { setupGuideTeamVisitedAt: now },
      });
    }
    if (
      dto.action === 'SKIP_FAQ' ||
      (dto.action === 'IMPORT_LEGACY' && dto.skippedFaq)
    ) {
      await this.prisma.storeMember.updateMany({
        where: { id, setupGuideFaqSkippedAt: null },
        data: { setupGuideFaqSkippedAt: now },
      });
    }
    if (
      dto.action === 'CONTINUE_OPTIONAL' ||
      (dto.action === 'IMPORT_LEGACY' && dto.phase === 'optional')
    ) {
      await this.prisma.storeMember.updateMany({
        where: { id, setupGuidePhase: 'ESSENTIAL' },
        data: { setupGuidePhase: 'OPTIONAL' },
      });
    }
    if (
      dto.action === 'FINISH' ||
      (dto.action === 'IMPORT_LEGACY' && dto.phase === 'done')
    ) {
      await this.prisma.storeMember.update({
        where: { id },
        data: { setupGuidePhase: 'DONE' },
      });
    }

    return this.get(storeId, userId);
  }

  private async requireMember(storeId: string, userId: string) {
    const member = await this.prisma.storeMember.findFirst({
      where: { storeId, userId, store: { status: StoreStatus.ACTIVE } },
      select: {
        id: true,
        setupGuidePhase: true,
        setupGuideAiSettingsVisitedAt: true,
        setupGuideChannelsVisitedAt: true,
        setupGuideTeamVisitedAt: true,
        setupGuideFaqSkippedAt: true,
      },
    });
    if (!member) {
      throw new NotFoundException(
        'Mağaza bulunamadı, arşivlenmiş veya erişiminiz yok.',
      );
    }
    return member;
  }

  private toResponse(member: {
    setupGuidePhase: string;
    setupGuideAiSettingsVisitedAt: Date | null;
    setupGuideChannelsVisitedAt: Date | null;
    setupGuideTeamVisitedAt: Date | null;
    setupGuideFaqSkippedAt: Date | null;
  }) {
    const phase = member.setupGuidePhase as Phase;
    return {
      phase: phase.toLowerCase() as Lowercase<Phase>,
      aiSettingsVisited: member.setupGuideAiSettingsVisitedAt !== null,
      channelsVisited: member.setupGuideChannelsVisitedAt !== null,
      teamVisited: member.setupGuideTeamVisitedAt !== null,
      skippedFaq: member.setupGuideFaqSkippedAt !== null,
    };
  }
}
