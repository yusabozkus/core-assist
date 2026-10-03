import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AuditActorType,
  AuditResult,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '../audit/audit-actions';
import {
  ActivityActorFilter,
  ActivityCategory,
  ActivityPeriod,
  ActivityQueryDto,
  ActivityResultFilter,
} from './activity-query.dto';

const actionDetails = {
  [AuditAction.QUESTION_ANSWER_SENT]: [
    'ANSWERS',
    'Yanıt gönderildi',
    'Cevap pazaryerine iletildi.',
    '/dashboard/inbox',
  ],
  [AuditAction.QUESTION_ANSWER_FAILED]: [
    'ANSWERS',
    'Yanıt gönderilemedi',
    'Cevap iletilemedi; gelen kutusundan kontrol edin.',
    '/dashboard/inbox',
  ],
  [AuditAction.RESPONSE_SETTINGS_UPDATED]: [
    'SETTINGS',
    'Yanıt ayarları değiştirildi',
    'Mağazanın AI ve yanıt ayarları güncellendi.',
    '/dashboard/automations',
  ],
  [AuditAction.PRODUCT_KNOWLEDGE_VERIFIED]: [
    'SETTINGS',
    'Ürün bilgisi öğretildi',
    'Eksik ürün bilgisi doğrulandı.',
    '/dashboard/automations/knowledge',
  ],
  [AuditAction.PRODUCT_KNOWLEDGE_UPDATED]: [
    'SETTINGS',
    'Ürün bilgisi güncellendi',
    'Öğretilen ürün bilgisi değiştirildi.',
    '/dashboard/automations/knowledge',
  ],
  [AuditAction.PRODUCT_KNOWLEDGE_ARCHIVED]: [
    'SETTINGS',
    'Ürün bilgisi kaldırıldı',
    'Öğretilen ürün bilgisi arşivlendi.',
    '/dashboard/automations/knowledge',
  ],
  [AuditAction.STORE_CREATED]: [
    'CATALOG',
    'Mağaza oluşturuldu',
    'Yeni mağaza eklendi.',
    '/dashboard/settings',
  ],
  [AuditAction.STORE_UPDATED]: [
    'CATALOG',
    'Mağaza güncellendi',
    'Mağaza bilgileri değiştirildi.',
    '/dashboard/settings',
  ],
  [AuditAction.STORE_ARCHIVED]: [
    'CATALOG',
    'Mağaza arşivlendi',
    'Mağaza erişimi durduruldu.',
    '/dashboard/settings',
  ],
  [AuditAction.STORE_RESTORED]: [
    'CATALOG',
    'Mağaza geri alındı',
    'Mağaza yeniden etkinleştirildi.',
    '/dashboard/settings',
  ],
  [AuditAction.STORE_DELETED]: [
    'CATALOG',
    'Mağaza silindi',
    'Mağaza kalıcı olarak silindi.',
    '/dashboard/settings',
  ],
  [AuditAction.CATALOG_SYNC_COMPLETED]: [
    'CATALOG',
    'Katalog güncellendi',
    'Ürün senkronizasyonu tamamlandı.',
    '/dashboard/channels/sync',
  ],
  [AuditAction.CATALOG_SYNC_FAILED]: [
    'CATALOG',
    'Katalog güncellenemedi',
    'Ürün senkronizasyonu başarısız oldu.',
    '/dashboard/channels/sync',
  ],
  [AuditAction.QUESTION_SYNC_COMPLETED]: [
    'CATALOG',
    'Sorular güncellendi',
    'Yeni sorular kontrol edildi.',
    '/dashboard/channels/sync',
  ],
  [AuditAction.QUESTION_SYNC_FAILED]: [
    'CATALOG',
    'Sorular güncellenemedi',
    'Soru senkronizasyonu başarısız oldu.',
    '/dashboard/channels/sync',
  ],
  [AuditAction.CHANNEL_CONNECTED]: [
    'CHANNELS',
    'Kanal bağlandı',
    'Pazaryeri bağlantısı kuruldu.',
    '/dashboard/channels',
  ],
  [AuditAction.CHANNEL_CONFIGURED]: [
    'CHANNELS',
    'Kanal ayarları değiştirildi',
    'Pazaryeri bağlantısı güncellendi.',
    '/dashboard/channels',
  ],
  [AuditAction.CHANNEL_DISCONNECTED]: [
    'CHANNELS',
    'Kanal bağlantısı kesildi',
    'Pazaryeri bağlantısı kesildi.',
    '/dashboard/channels',
  ],
  [AuditAction.CHANNEL_RECONNECTED]: [
    'CHANNELS',
    'Kanal yeniden bağlandı',
    'Pazaryeri bağlantısı yenilendi.',
    '/dashboard/channels',
  ],
  [AuditAction.CHANNEL_REMOVED]: [
    'CHANNELS',
    'Kanal kaldırıldı',
    'Pazaryeri bağlantısı kaldırıldı.',
    '/dashboard/channels',
  ],
  [AuditAction.TEAM_INVITATION_CREATED]: [
    'TEAM',
    'Ekip daveti oluşturuldu',
    'Yeni davet bağlantısı hazırlandı.',
    '/dashboard/team',
  ],
  [AuditAction.TEAM_INVITATION_LINK_RENEWED]: [
    'TEAM',
    'Davet bağlantısı yenilendi',
    'Davet için yeni bağlantı oluşturuldu.',
    '/dashboard/team',
  ],
  [AuditAction.TEAM_INVITATION_REVOKED]: [
    'TEAM',
    'Ekip daveti iptal edildi',
    'Bekleyen davet iptal edildi.',
    '/dashboard/team',
  ],
  [AuditAction.TEAM_INVITATION_ACCEPTED]: [
    'TEAM',
    'Ekip daveti kabul edildi',
    'Yeni ekip üyesi katıldı.',
    '/dashboard/team',
  ],
  [AuditAction.TEAM_MEMBER_ACCESS_CHANGED]: [
    'TEAM',
    'Ekip yetkisi değiştirildi',
    'Üyenin erişimi güncellendi.',
    '/dashboard/team',
  ],
  [AuditAction.TEAM_MEMBER_REMOVED]: [
    'TEAM',
    'Ekip üyesi çıkarıldı',
    'Üyenin erişimi kaldırıldı.',
    '/dashboard/team',
  ],
  [AuditAction.BILLING_CHECKOUT_OPENED]: [
    'BILLING',
    'Ödeme adımı açıldı',
    'Yeni ödeme işlemi başlatıldı.',
    '/billing',
  ],
  [AuditAction.BILLING_CHECKOUT_CANCELED]: [
    'BILLING',
    'Ödeme adımı iptal edildi',
    'Bekleyen ödeme işlemi kapatıldı.',
    '/billing',
  ],
  [AuditAction.BILLING_PLAN_CHANGE_CONFIRMED]: [
    'BILLING',
    'Plan değişikliği istendi',
    'Abonelik planı değişikliği onaylandı.',
    '/billing',
  ],
} as const satisfies Record<string, readonly [string, string, string, string]>;

const teamActions = Object.keys(actionDetails).filter((action) =>
  action.startsWith('TEAM_'),
);
const billingActions = Object.keys(actionDetails).filter((action) =>
  action.startsWith('BILLING_'),
);
const restrictedActions = [
  ...teamActions,
  ...billingActions,
  AuditAction.STORE_DELETED,
];

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, userId: string, query: ActivityQueryDto) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, members: { some: { userId } } },
      select: {
        workspaceId: true,
        workspace: {
          select: {
            ownerId: true,
            members: { where: { userId }, select: { role: true } },
          },
        },
      },
    });
    if (!store)
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');

    const canViewAccountEvents =
      store.workspace.ownerId === userId ||
      store.workspace.members.some(
        (member) =>
          member.role === WorkspaceRole.OWNER ||
          member.role === WorkspaceRole.ADMIN,
      );
    const actions = Object.entries(actionDetails)
      .filter(
        ([, detail]) =>
          query.category === ActivityCategory.ALL ||
          detail[0] === String(query.category),
      )
      .map(([action]) => action)
      .filter(
        (action) => canViewAccountEvents || !restrictedActions.includes(action),
      );

    if (actions.length === 0)
      return { items: [], nextCursor: null, canViewAccountEvents };

    const periodMs = {
      [ActivityPeriod.ALL]: 0,
      [ActivityPeriod.DAY]: 24 * 60 * 60 * 1000,
      [ActivityPeriod.WEEK]: 7 * 24 * 60 * 60 * 1000,
      [ActivityPeriod.MONTH]: 30 * 24 * 60 * 60 * 1000,
    }[query.period];
    const search = query.q?.trim();
    const where: Prisma.AuditLogWhereInput = {
      action: { in: actions },
      ...(query.actor === ActivityActorFilter.SYSTEM
        ? { actorType: AuditActorType.SYSTEM }
        : query.actor === ActivityActorFilter.TEAM
          ? { actorType: AuditActorType.USER }
          : {}),
      result:
        query.result === ActivityResultFilter.ALL
          ? { in: [AuditResult.SUCCESS, AuditResult.FAILURE] }
          : query.result === ActivityResultFilter.SUCCESS
            ? AuditResult.SUCCESS
            : AuditResult.FAILURE,
      ...(periodMs
        ? { createdAt: { gte: new Date(Date.now() - periodMs) } }
        : {}),
      OR: [
        { storeId, action: { notIn: restrictedActions } },
        ...(canViewAccountEvents
          ? [
              {
                workspaceId: store.workspaceId,
                action: { in: restrictedActions },
              },
            ]
          : []),
      ],
      ...(search
        ? {
            AND: [
              {
                OR: [
                  { actorName: { contains: search, mode: 'insensitive' } },
                  { actorEmail: { contains: search, mode: 'insensitive' } },
                  { targetId: { contains: search, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };

    if (query.cursor) {
      const cursor = await this.prisma.auditLog.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      if (!cursor) return { items: [], nextCursor: null, canViewAccountEvents };
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        action: true,
        result: true,
        actorType: true,
        actorUserId: true,
        actorName: true,
        actorEmail: true,
        metadata: true,
        targetId: true,
      },
    });
    const hasMore = rows.length > query.limit;
    const visible = rows.slice(0, query.limit);
    const actorIds = [
      ...new Set(
        visible
          .filter((row) => row.actorType !== 'SYSTEM')
          .map((row) => row.actorUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, image: true },
        })
      : [];
    const actorImages = new Map(
      actors.map((actor) => [
        actor.id,
        actor.image?.startsWith('https://') ? actor.image : null,
      ]),
    );
    return {
      items: visible.map((row) => {
        const [category, title, summary, route] =
          actionDetails[row.action as keyof typeof actionDetails];
        return {
          id: row.id,
          createdAt: row.createdAt,
          category,
          title,
          summary: publicSummary(row.action, row.metadata, summary),
          result: row.result,
          actorType: row.actorType,
          actorName:
            row.actorType === 'SYSTEM'
              ? 'Core Asistan'
              : row.actorName || 'Ekip üyesi',
          actorEmail: row.actorType === 'SYSTEM' ? null : row.actorEmail,
          actorAvatarUrl:
            row.actorType === 'SYSTEM' || !row.actorUserId
              ? null
              : (actorImages.get(row.actorUserId) ?? null),
          href:
            route === '/dashboard/inbox' && row.targetId
              ? `/dashboard/inbox?question=${encodeURIComponent(row.targetId)}`
              : route,
        };
      }),
      nextCursor: hasMore ? (visible.at(-1)?.id ?? null) : null,
      canViewAccountEvents,
    };
  }
}

const settingLabels: Record<string, string> = {
  automationMode: 'Otomatik gönderim',
  minimumAutoSendConfidence: 'Güven eşiği',
  tone: 'Yanıt tonu',
  responseLength: 'Yanıt uzunluğu',
  greetingEnabled: 'Karşılama',
  closingEnabled: 'Kapanış',
  heightWeightSizeRecommendationEnabled: 'Beden önerisi',
  emojiPolicy: 'Emoji kullanımı',
  preferredEmoji: 'Kullanılabilecek emojiler',
  brandDescription: 'Marka bilgisi',
  shippingPolicy: 'Kargo politikası',
  returnPolicy: 'İade politikası',
  exchangePolicy: 'Değişim politikası',
  warrantyPolicy: 'Garanti politikası',
  additionalInformation: 'Ek bilgiler',
  faqs: 'Sık sorulan sorular',
  instructions: 'AI talimatları',
  channelOverrides: 'Kanal istisnaları',
};

function publicSummary(
  action: string,
  metadata: Prisma.JsonValue | null,
  fallback: string,
) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
    return fallback;
  if (
    action === AuditAction.QUESTION_ANSWER_SENT ||
    action === AuditAction.QUESTION_ANSWER_FAILED
  ) {
    const origin =
      metadata.answerOrigin === 'AUTOMATION' ? 'Otomatik' : 'Manuel';
    return action === AuditAction.QUESTION_ANSWER_SENT
      ? `${origin} yanıt pazaryerine iletildi.`
      : `${origin} yanıt iletilemedi; gelen kutusundan kontrol edin.`;
  }
  if (
    action === AuditAction.RESPONSE_SETTINGS_UPDATED &&
    Array.isArray(metadata.changedFields)
  ) {
    const labels = metadata.changedFields
      .filter((field): field is string => typeof field === 'string')
      .map((field) => settingLabels[field])
      .filter(Boolean);
    if (labels.length > 0) {
      return `${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ' ve diğer ayarlar' : ''} değiştirildi.`;
    }
  }
  return fallback;
}
