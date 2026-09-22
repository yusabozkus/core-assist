import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  AiAutomationMode,
  AiDraftOutcome,
  AiDraftTrigger,
  AuditActorType,
  AuditOrigin,
  AuditResult,
  BillingCycle,
  BillingPlan,
  BillingSubscriptionStatus,
  BillingUsageMetric,
  CatalogSyncKind,
  CatalogSyncStage,
  CatalogSyncStatus,
  CatalogSyncTrigger,
  ChannelConnectionStatus,
  ChannelType,
  IncomingEventProcessingStatus,
  IncomingEventType,
  IntegrationEnvironment,
  NotificationSeverity,
  NotificationType,
  ProductQuestionStatus,
  ProductStatus,
  ProductVariantStatus,
  QuestionAnswerComposition,
  QuestionAnswerOrigin,
  QuestionAnswerStatus,
  QuestionReplyDecision,
  StoreRole,
  SupportMessageAuthorType,
  SupportTicketCategory,
  SupportTicketImpact,
  SupportTicketPriority,
  SupportTicketStatus,
  WorkspaceRole,
} from '../generated/prisma/enums';

const DEMO_EMAIL_SUFFIX = '@demo.coreasistan.local';
const TARGET_USER_COUNT = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

const userSeeds = [
  ['Elif Yılmaz', 'elif.yilmaz'],
  ['Selin Demir', 'selin.demir'],
  ['Can Arslan', 'can.arslan'],
  ['Derya Şahin', 'derya.sahin'],
  ['Melis Aksoy', 'melis.aksoy'],
  ['Ozan Yıldız', 'ozan.yildiz'],
  ['İrem Polat', 'irem.polat'],
  ['Kerem Güneş', 'kerem.gunes'],
  ['Mert Kaya', 'mert.kaya'],
  ['Burak Aydın', 'burak.aydin'],
  ['Zeynep Çelik', 'zeynep.celik'],
  ['Emre Koç', 'emre.koc'],
] as const;

const accountSeeds = [
  {
    workspaceName: 'ModaNova',
    storeNames: ['ModaNova Kadın', 'ModaNova Outlet'],
    plan: BillingPlan.GROWTH,
    cycle: BillingCycle.MONTHLY,
    status: BillingSubscriptionStatus.ACTIVE,
    currentUsage: 3_840,
    previousUsage: 3_190,
    productCount: 82,
  },
  {
    workspaceName: 'Teknobox',
    storeNames: ['Teknobox', 'Teknobox Gaming'],
    plan: BillingPlan.BUSINESS,
    cycle: BillingCycle.ANNUAL,
    status: BillingSubscriptionStatus.ACTIVE,
    currentUsage: 11_240,
    previousUsage: 9_870,
    productCount: 128,
  },
  {
    workspaceName: 'Evora Home',
    storeNames: ['Evora Home'],
    plan: BillingPlan.STARTER,
    cycle: BillingCycle.MONTHLY,
    status: BillingSubscriptionStatus.ACTIVE,
    currentUsage: 620,
    previousUsage: 510,
    productCount: 46,
  },
  {
    workspaceName: 'FitMarket',
    storeNames: ['FitMarket'],
    plan: BillingPlan.GROWTH,
    cycle: BillingCycle.MONTHLY,
    status: BillingSubscriptionStatus.PAST_DUE,
    currentUsage: 4_760,
    previousUsage: 4_280,
    productCount: 73,
  },
  {
    workspaceName: 'Luma Kozmetik',
    storeNames: ['Luma Kozmetik'],
    plan: BillingPlan.STARTER,
    cycle: BillingCycle.MONTHLY,
    status: BillingSubscriptionStatus.TRIALING,
    currentUsage: 74,
    previousUsage: 0,
    productCount: 31,
  },
  {
    workspaceName: 'PetSepeti',
    storeNames: ['PetSepeti'],
    plan: BillingPlan.BUSINESS,
    cycle: BillingCycle.MONTHLY,
    status: BillingSubscriptionStatus.CANCELED,
    currentUsage: 8_420,
    previousUsage: 7_940,
    productCount: 66,
  },
  {
    workspaceName: 'OfisPlus',
    storeNames: ['OfisPlus'],
    plan: BillingPlan.STARTER,
    cycle: BillingCycle.MONTHLY,
    status: BillingSubscriptionStatus.EXPIRED,
    currentUsage: 1_120,
    previousUsage: 1_360,
    productCount: 38,
  },
  {
    workspaceName: 'MiniModa',
    storeNames: ['MiniModa'],
    plan: BillingPlan.STARTER,
    cycle: BillingCycle.MONTHLY,
    status: BillingSubscriptionStatus.TRIALING,
    currentUsage: 42,
    previousUsage: 0,
    productCount: 24,
  },
] as const;

const ticketSeeds = [
  {
    subject: 'Trendyol soruları senkronize olmuyor',
    category: SupportTicketCategory.CHANNELS,
    impact: SupportTicketImpact.BLOCKED,
    priority: SupportTicketPriority.URGENT,
    status: SupportTicketStatus.OPEN,
    ageDays: 3,
    overdue: true,
  },
  {
    subject: 'AI yanıtları ürün rengini yanlış yorumluyor',
    category: SupportTicketCategory.AI_AUTOMATION,
    impact: SupportTicketImpact.PARTIAL,
    priority: SupportTicketPriority.HIGH,
    status: SupportTicketStatus.IN_PROGRESS,
    ageDays: 2,
    overdue: false,
  },
  {
    subject: 'Stok adetleri pazaryeriyle uyuşmuyor',
    category: SupportTicketCategory.CATALOG_INVENTORY,
    impact: SupportTicketImpact.PARTIAL,
    priority: SupportTicketPriority.HIGH,
    status: SupportTicketStatus.WAITING_CUSTOMER,
    ageDays: 5,
    overdue: false,
  },
  {
    subject: 'Growth planı faturası hakkında',
    category: SupportTicketCategory.BILLING_ACCOUNT,
    impact: SupportTicketImpact.QUESTION,
    priority: SupportTicketPriority.NORMAL,
    status: SupportTicketStatus.RESOLVED,
    ageDays: 9,
    overdue: false,
  },
  {
    subject: 'Ekip üyesi mağazayı göremiyor',
    category: SupportTicketCategory.TEAM_ACCESS,
    impact: SupportTicketImpact.PARTIAL,
    priority: SupportTicketPriority.NORMAL,
    status: SupportTicketStatus.CLOSED,
    ageDays: 14,
    overdue: false,
  },
  {
    subject: 'Hepsiburada bağlantısı hata veriyor',
    category: SupportTicketCategory.CHANNELS,
    impact: SupportTicketImpact.BLOCKED,
    priority: SupportTicketPriority.HIGH,
    status: SupportTicketStatus.OPEN,
    ageDays: 1,
    overdue: true,
  },
  {
    subject: 'Otomatik gönderim eşiğini nasıl değiştirebilirim?',
    category: SupportTicketCategory.AI_AUTOMATION,
    impact: SupportTicketImpact.QUESTION,
    priority: SupportTicketPriority.NORMAL,
    status: SupportTicketStatus.IN_PROGRESS,
    ageDays: 1,
    overdue: false,
  },
  {
    subject: 'Yeni mağaza eklerken plan limiti uyarısı',
    category: SupportTicketCategory.BILLING_ACCOUNT,
    impact: SupportTicketImpact.QUESTION,
    priority: SupportTicketPriority.NORMAL,
    status: SupportTicketStatus.OPEN,
    ageDays: 0,
    overdue: false,
  },
] as const;

async function run() {
  assertSafeEnvironment();
  const connectionString = requiredDatabaseUrl();
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const before = await databaseSummary(prisma);
    const result = await prisma.$transaction(
      async (transaction) => seedDemoData(transaction),
      { timeout: 120_000, maxWait: 10_000 },
    );
    const after = await databaseSummary(prisma);

    console.log('\nCore Asistan gerçekçi demo verisi hazır.');
    console.table({ before, after });
    console.log(`Demo kullanıcı: ${result.demoUsers}`);
    console.log(`Demo müşteri hesabı: ${result.workspaces}`);
    console.log(`Demo mağaza: ${result.stores}`);
    console.log(`Demo ürün: ${result.products}`);
    console.log(`Demo ürün sorusu: ${result.questions}`);
    console.log(`Demo destek talebi: ${result.tickets}`);
    if (result.preservedUsers > TARGET_USER_COUNT) {
      console.warn(
        `Veri tabanında zaten ${result.preservedUsers} gerçek kullanıcı bulunduğu için güvenli şekilde kullanıcı silinmedi.`,
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function seedDemoData(transaction: Prisma.TransactionClient) {
  const staleDemoUsers = await transaction.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
    select: { id: true },
  });
  const staleDemoUserIds = staleDemoUsers.map((user) => user.id);
  if (staleDemoUserIds.length) {
    await transaction.user.deleteMany({
      where: { id: { in: staleDemoUserIds } },
    });
  }
  await transaction.auditLog.deleteMany({ where: { targetType: 'DEMO_DATA' } });

  const preservedUsers = await transaction.user.count();
  const demoUserCount = Math.max(0, TARGET_USER_COUNT - preservedUsers);
  if (demoUserCount === 0) {
    throw new Error(
      `Veri tabanında zaten ${preservedUsers} kullanıcı var. Mevcut kullanıcıları silmeden 12 kullanıcı hedefi uygulanamaz.`,
    );
  }

  const now = new Date();
  const demoUsers = userSeeds
    .slice(0, demoUserCount)
    .map(([name, local], index) => ({
      id: demoId('d0', index + 1),
      name,
      email: `${local}${DEMO_EMAIL_SUFFIX}`,
      emailVerified: true,
      onboardingCompletedAt:
        index === 7 ? null : daysAgo(now, Math.max(1, 74 - index * 6)),
      createdAt: daysAgo(now, 90 - index * 6),
      updatedAt: daysAgo(now, Math.max(0, index % 5)),
    }));
  await transaction.user.createMany({ data: demoUsers });

  await transaction.account.createMany({
    data: demoUsers.map((user, index) => ({
      id: demoId('c1', index + 1),
      accountId: `demo-${index + 1}`,
      providerId: index % 3 === 0 ? 'microsoft' : 'google',
      userId: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
  });
  await transaction.session.createMany({
    data: demoUsers
      .slice(0, Math.max(1, demoUsers.length - 2))
      .map((user, index) => ({
        id: demoId('c0', index + 1),
        token: `core-asistan-demo-session-${index + 1}`,
        userId: user.id,
        expiresAt: daysFrom(now, 21),
        ipAddress: `88.240.10.${20 + index}`,
        userAgent: index % 2 === 0 ? 'Chrome on Windows' : 'Safari on macOS',
        createdAt: daysAgo(now, 14 - (index % 8)),
        updatedAt: hoursAgo(now, 2 + index * 7),
      })),
  });

  const ownerCount = Math.min(accountSeeds.length, demoUsers.length);
  const profiles = accountSeeds.slice(0, ownerCount);
  const workspaceRows = profiles.map((profile, index) => ({
    id: demoId('d1', index + 1),
    name: profile.workspaceName,
    ownerId: demoUsers[index].id,
    createdAt: demoUsers[index].createdAt,
    updatedAt: hoursAgo(now, index + 1),
  }));
  await transaction.workspace.createMany({ data: workspaceRows });
  await transaction.workspaceMember.createMany({
    data: workspaceRows.map((workspace, index) => ({
      id: demoId('b0', index + 1),
      workspaceId: workspace.id,
      userId: demoUsers[index].id,
      role: WorkspaceRole.OWNER,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    })),
  });

  const extraUsers = demoUsers.slice(ownerCount);
  await transaction.workspaceMember.createMany({
    data: extraUsers.map((user, index) => ({
      id: demoId('b1', index + 1),
      workspaceId: workspaceRows[index % Math.min(3, workspaceRows.length)].id,
      userId: user.id,
      role: index % 3 === 0 ? WorkspaceRole.ADMIN : WorkspaceRole.MEMBER,
      createdAt: daysAgo(now, 34 - index * 3),
      updatedAt: daysAgo(now, index),
    })),
  });

  const stores: Array<{
    id: string;
    workspaceIndex: number;
    name: string;
    productCount: number;
  }> = [];
  let storeSequence = 1;
  profiles.forEach((profile, workspaceIndex) => {
    const storeNames: readonly string[] = profile.storeNames;
    storeNames.forEach((name, storeIndex) => {
      stores.push({
        id: demoId('d2', storeSequence++),
        workspaceIndex,
        name,
        productCount:
          storeIndex === 0
            ? profile.productCount
            : Math.max(18, Math.round(profile.productCount * 0.38)),
      });
    });
  });
  await transaction.store.createMany({
    data: stores.map((store, index) => ({
      id: store.id,
      workspaceId: workspaceRows[store.workspaceIndex].id,
      name: store.name,
      timezone: 'Europe/Istanbul',
      status: 'ACTIVE',
      inventoryPolicy: index % 3 === 0 ? 'SHARED' : 'CHANNEL_SPECIFIC',
      createdAt: daysAgo(now, 72 - index * 4),
      updatedAt: hoursAgo(now, 1 + index),
    })),
  });

  const storeMembers: Prisma.StoreMemberCreateManyInput[] = [];
  stores.forEach((store, index) => {
    const owner = demoUsers[store.workspaceIndex];
    storeMembers.push({
      id: demoId('b2', index + 1),
      storeId: store.id,
      userId: owner.id,
      role: StoreRole.OWNER,
      createdAt: daysAgo(now, 70 - index * 3),
      updatedAt: hoursAgo(now, index + 2),
    });
  });
  extraUsers.forEach((user, index) => {
    const workspaceIndex = index % Math.min(3, workspaceRows.length);
    stores
      .filter((store) => store.workspaceIndex === workspaceIndex)
      .forEach((store, storeIndex) => {
        storeMembers.push({
          id: demoId('b3', index * 10 + storeIndex + 1),
          storeId: store.id,
          userId: user.id,
          role: index % 3 === 0 ? StoreRole.ADMIN : StoreRole.AGENT,
          createdAt: daysAgo(now, 30 - index * 2),
          updatedAt: daysAgo(now, index),
        });
      });
  });
  await transaction.storeMember.createMany({ data: storeMembers });

  const connections: Array<{
    id: string;
    storeId: string;
    workspaceIndex: number;
    providerKey: string;
    status: ChannelConnectionStatus;
  }> = [];
  let connectionSequence = 1;
  stores.forEach((store, storeIndex) => {
    const providers =
      storeIndex < 4 || store.workspaceIndex === 3
        ? ['trendyol', 'hepsiburada']
        : [storeIndex % 2 ? 'hepsiburada' : 'trendyol'];
    providers.forEach((providerKey) => {
      const isErrored =
        store.workspaceIndex === 3 && providerKey === 'hepsiburada';
      connections.push({
        id: demoId('d3', connectionSequence++),
        storeId: store.id,
        workspaceIndex: store.workspaceIndex,
        providerKey,
        status: isErrored
          ? ChannelConnectionStatus.ERROR
          : ChannelConnectionStatus.CONNECTED,
      });
    });
  });
  await transaction.channelConnection.createMany({
    data: connections.map((connection, index) => ({
      id: connection.id,
      storeId: connection.storeId,
      providerKey: connection.providerKey,
      type: ChannelType.COMMERCE,
      environment: IntegrationEnvironment.SANDBOX,
      status: connection.status,
      connectedAt: daysAgo(now, 58 - (index % 30)),
      lastSyncAt: hoursAgo(now, 1 + (index % 14)),
      lastInventorySyncAt: hoursAgo(now, 2 + (index % 12)),
      lastQuestionSyncAt: hoursAgo(now, 1 + (index % 7)),
      failureReason:
        connection.status === ChannelConnectionStatus.ERROR
          ? 'Pazaryeri kimlik bilgileri doğrulanamadı.'
          : null,
      createdAt: daysAgo(now, 60 - (index % 30)),
      updatedAt: hoursAgo(now, 1 + (index % 8)),
    })),
  });

  const products: Prisma.ProductCreateManyInput[] = [];
  const variants: Prisma.ProductVariantCreateManyInput[] = [];
  const productIdsByStore = new Map<string, string[]>();
  const categories = ['Giyim', 'Elektronik', 'Ev ve Yaşam', 'Kozmetik', 'Spor'];
  let productSequence = 1;
  let variantSequence = 1;
  stores.forEach((store, storeIndex) => {
    const ids: string[] = [];
    for (let index = 0; index < store.productCount; index += 1) {
      const productId = demoId('d6', productSequence++);
      ids.push(productId);
      products.push({
        id: productId,
        storeId: store.id,
        title: `${store.name} ${categories[(storeIndex + index) % categories.length]} Ürünü ${String(index + 1).padStart(3, '0')}`,
        description:
          'Güncel katalogdan senkronize edilmiş demo ürün açıklaması.',
        brand: store.name.split(' ')[0],
        category: categories[(storeIndex + index) % categories.length],
        status: ProductStatus.ACTIVE,
        createdAt: daysAgo(now, 55 - (index % 45)),
        updatedAt: hoursAgo(now, index % 72),
      });
      variants.push({
        id: demoId('d7', variantSequence++),
        productId,
        title: index % 2 === 0 ? 'Standart' : 'M',
        sku: `DEMO-${storeIndex + 1}-${String(index + 1).padStart(4, '0')}`,
        barcode: `869990${String(storeIndex).padStart(2, '0')}${String(index).padStart(4, '0')}`,
        color: ['Siyah', 'Beyaz', 'Lacivert', 'Bej'][index % 4],
        size: ['S', 'M', 'L', 'Standart'][index % 4],
        price: new Prisma.Decimal(
          249 + ((index * 37 + storeIndex * 53) % 2_400),
        ),
        currency: 'TRY',
        stock: index % 13 === 0 ? 0 : 2 + ((index * 7) % 74),
        status:
          index % 13 === 0
            ? ProductVariantStatus.OUT_OF_STOCK
            : ProductVariantStatus.ACTIVE,
        sourceUpdatedAt: hoursAgo(now, index % 24),
        lastSyncedAt: hoursAgo(now, index % 12),
        createdAt: daysAgo(now, 55 - (index % 45)),
        updatedAt: hoursAgo(now, index % 72),
      });
    }
    productIdsByStore.set(store.id, ids);
  });
  await createManyInChunks(products, (data) =>
    transaction.product.createMany({ data }),
  );
  await createManyInChunks(variants, (data) =>
    transaction.productVariant.createMany({ data }),
  );

  const subscriptionIds: string[] = [];
  const periodIds: string[] = [];
  const previousPeriodIds: string[] = [];
  for (let index = 0; index < profiles.length; index += 1) {
    const profile = profiles[index];
    const workspace = workspaceRows[index];
    const subscriptionId = demoId('d4', index + 1);
    const currentPeriodStart = daysAgo(now, 12 + (index % 8));
    const currentPeriodEnd =
      profile.status === BillingSubscriptionStatus.EXPIRED
        ? daysAgo(now, 2)
        : daysFrom(
            currentPeriodStart,
            profile.cycle === BillingCycle.ANNUAL ? 365 : 30,
          );
    subscriptionIds.push(subscriptionId);
    await transaction.billingSubscription.create({
      data: {
        id: subscriptionId,
        workspaceId: workspace.id,
        plan: profile.plan,
        cycle: profile.cycle,
        status: profile.status,
        paddleCustomerId: `ctm_demo_${String(index + 1).padStart(3, '0')}`,
        paddleSubscriptionId: `sub_demo_${String(index + 1).padStart(3, '0')}`,
        paddlePriceId: `pri_demo_${profile.plan.toLowerCase()}_${profile.cycle.toLowerCase()}`,
        currentPeriodStart,
        currentPeriodEnd,
        trialEndsAt:
          profile.status === BillingSubscriptionStatus.TRIALING
            ? daysFrom(now, 6 - (index % 3))
            : null,
        cancelAtPeriodEnd:
          profile.status === BillingSubscriptionStatus.CANCELED,
        canceledAt:
          profile.status === BillingSubscriptionStatus.CANCELED
            ? daysAgo(now, 4)
            : null,
        paddleUpdatedAt: hoursAgo(now, index + 1),
        paddleSnapshotAt: hoursAgo(now, index + 1),
        lastReconciledAt: hoursAgo(now, index + 1),
        reconcileAfter: daysFrom(now, 180),
        reconcileFailures:
          profile.status === BillingSubscriptionStatus.PAST_DUE ? 2 : 0,
        reconcileErrorCode:
          profile.status === BillingSubscriptionStatus.PAST_DUE
            ? 'PAYMENT_RETRY_SCHEDULED'
            : null,
        usagePeriodAnchor: currentPeriodStart,
        createdAt: workspace.createdAt,
        updatedAt: hoursAgo(now, index + 1),
      },
    });

    const currentPeriodId = demoId('d5', index + 1);
    const previousPeriodId = demoId('d5', index + 101);
    periodIds.push(currentPeriodId);
    previousPeriodIds.push(previousPeriodId);
    await transaction.billingUsagePeriod.createMany({
      data: [
        {
          id: currentPeriodId,
          workspaceId: workspace.id,
          subscriptionId,
          periodStart: currentPeriodStart,
          periodEnd: currentPeriodEnd,
          aiQuestionUnits: profile.currentUsage,
          createdAt: currentPeriodStart,
          updatedAt: hoursAgo(now, index),
        },
        {
          id: previousPeriodId,
          workspaceId: workspace.id,
          subscriptionId,
          periodStart: daysAgo(currentPeriodStart, 30),
          periodEnd: currentPeriodStart,
          aiQuestionUnits: profile.previousUsage,
          createdAt: daysAgo(currentPeriodStart, 30),
          updatedAt: currentPeriodStart,
        },
      ],
    });
  }

  const usageEvents: Prisma.BillingUsageEventCreateManyInput[] = [];
  let usageEventSequence = 1;
  profiles.forEach((profile, workspaceIndex) => {
    splitQuantity(profile.currentUsage, 6).forEach((quantity, index) => {
      usageEvents.push({
        id: demoId('c2', usageEventSequence++),
        workspaceId: workspaceRows[workspaceIndex].id,
        usagePeriodId: periodIds[workspaceIndex],
        metric: BillingUsageMetric.AI_QUESTION,
        quantity,
        idempotencyKey: `demo-current-${workspaceIndex}-${index}`,
        sourceType: 'DEMO_AI_BATCH',
        sourceId: `demo-current-${workspaceIndex}-${index}`,
        metadata: {
          seeded: true,
          channel: index % 2 === 0 ? 'trendyol' : 'hepsiburada',
        },
        createdAt: daysAgo(now, 2 + index * 3 + (workspaceIndex % 2)),
      });
    });
    splitQuantity(profile.previousUsage, 5).forEach((quantity, index) => {
      if (quantity === 0) return;
      usageEvents.push({
        id: demoId('c2', usageEventSequence++),
        workspaceId: workspaceRows[workspaceIndex].id,
        usagePeriodId: previousPeriodIds[workspaceIndex],
        metric: BillingUsageMetric.AI_QUESTION,
        quantity,
        idempotencyKey: `demo-previous-${workspaceIndex}-${index}`,
        sourceType: 'DEMO_AI_BATCH',
        sourceId: `demo-previous-${workspaceIndex}-${index}`,
        metadata: { seeded: true },
        createdAt: daysAgo(now, 33 + index * 4 + (workspaceIndex % 3)),
      });
    });
  });
  await transaction.billingUsageEvent.createMany({ data: usageEvents });

  const incomingEvents: Prisma.IncomingEventCreateManyInput[] = [];
  const questions: Prisma.ProductQuestionCreateManyInput[] = [];
  const drafts: Prisma.AiDraftAttemptCreateManyInput[] = [];
  const answers: Prisma.QuestionAnswerCreateManyInput[] = [];
  let incomingSequence = 1;
  let questionSequence = 1;
  let draftSequence = 1;
  let answerSequence = 1;
  const customerNames = [
    'Ayşe K.',
    'Mehmet T.',
    'Selin G.',
    'Emre A.',
    'Zeynep Y.',
    'Can B.',
  ];
  const questionTexts = [
    'Ürünün kalıbı nasıldır, kendi bedenimi almalı mıyım?',
    'Siparişim bugün verilirse ne zaman kargoya çıkar?',
    'Bu ürünün farklı renk seçeneği var mı?',
    'Materyali nedir ve yıkama talimatı nasıldır?',
    'Stok bilgisi güncel mi?',
    'İade ve değişim süresi kaç gündür?',
  ];

  profiles.forEach((_, workspaceIndex) => {
    const store = stores.find(
      (candidate) => candidate.workspaceIndex === workspaceIndex,
    )!;
    const connection = connections.find(
      (candidate) =>
        candidate.storeId === store.id &&
        candidate.status === ChannelConnectionStatus.CONNECTED,
    )!;
    const productIds = productIdsByStore.get(store.id)!;
    for (let index = 0; index < 6; index += 1) {
      const incomingId = demoId('d8', incomingSequence++);
      const questionId = demoId('d9', questionSequence++);
      const draftId = demoId('da', draftSequence++);
      const decision =
        index === 4
          ? QuestionReplyDecision.NEEDS_REVIEW
          : index === 5
            ? QuestionReplyDecision.DO_NOT_REPLY
            : QuestionReplyDecision.READY_FOR_SEND;
      const isAnswered = index < 3;
      const isIgnored = decision === QuestionReplyDecision.DO_NOT_REPLY;
      const questionStatus = isAnswered
        ? ProductQuestionStatus.ANSWERED
        : isIgnored
          ? ProductQuestionStatus.IGNORED
          : ProductQuestionStatus.DRAFTED;
      const createdAt = daysAgo(now, (workspaceIndex * 2 + index) % 27);
      const answer =
        index === 0
          ? 'Merhaba, ürünümüz standart kalıptır. Kendi bedeninizi tercih edebilirsiniz. İyi günler dileriz.'
          : 'Merhaba, ürün sayfasındaki güncel bilgiler doğrultusunda yardımcı olabiliriz. İyi günler dileriz.';
      incomingEvents.push({
        id: incomingId,
        storeId: store.id,
        connectionId: connection.id,
        externalEventId: `demo-event-${workspaceIndex}-${index}`,
        eventType: IncomingEventType.PRODUCT_QUESTION,
        externalCreatedAt: createdAt,
        receivedAt: createdAt,
        processingStatus: IncomingEventProcessingStatus.PROCESSED,
        payload: { seeded: true, question: questionTexts[index] },
        processedAt: new Date(createdAt.getTime() + 4_000),
        createdAt,
        updatedAt: new Date(createdAt.getTime() + 5_000),
      });
      questions.push({
        id: questionId,
        storeId: store.id,
        connectionId: connection.id,
        incomingEventId: incomingId,
        productId: productIds[index % productIds.length],
        externalQuestionId: `demo-question-${workspaceIndex}-${index}`,
        externalProductId: `demo-product-${workspaceIndex}-${index}`,
        externalCustomerId: `demo-customer-${workspaceIndex}-${index}`,
        customerName: customerNames[index],
        productTitleSnapshot: products.find(
          (product) => product.id === productIds[index % productIds.length],
        )?.title,
        question: questionTexts[index],
        status: questionStatus,
        answer: isAnswered ? answer : null,
        draftDecision: decision,
        draftConfidence:
          decision === QuestionReplyDecision.READY_FOR_SEND
            ? 0.91 - index * 0.02
            : 0.58,
        draftAnswerability:
          decision === QuestionReplyDecision.DO_NOT_REPLY
            ? 'OUT_OF_SCOPE'
            : 'ANSWERABLE',
        draftRisks:
          decision === QuestionReplyDecision.NEEDS_REVIEW
            ? ['MISSING_PRODUCT_DETAIL']
            : [],
        draftMissingInformation:
          decision === QuestionReplyDecision.NEEDS_REVIEW
            ? ['Ürün ölçü tablosu']
            : [],
        draftEvidenceIds: [`product:${productIds[index % productIds.length]}`],
        draftModel: 'gemini-3.5-flash-lite',
        draftedAt: new Date(createdAt.getTime() + 12_000),
        draftProcessingStatus: null,
        externalCreatedAt: createdAt,
        answeredAt: isAnswered ? new Date(createdAt.getTime() + 40_000) : null,
        createdAt,
        updatedAt: isAnswered
          ? new Date(createdAt.getTime() + 40_000)
          : new Date(createdAt.getTime() + 12_000),
      });
      drafts.push({
        id: draftId,
        storeId: store.id,
        questionId,
        requestedByUserId: demoUsers[workspaceIndex].id,
        trigger:
          index % 4 === 0 ? AiDraftTrigger.MANUAL : AiDraftTrigger.AUTOMATION,
        outcome: isAnswered
          ? AiDraftOutcome.SENT
          : isIgnored
            ? AiDraftOutcome.SELECTED
            : AiDraftOutcome.AVAILABLE,
        answer,
        decision,
        confidence:
          decision === QuestionReplyDecision.READY_FOR_SEND
            ? 0.91 - index * 0.02
            : 0.58,
        answerability:
          decision === QuestionReplyDecision.DO_NOT_REPLY
            ? 'OUT_OF_SCOPE'
            : 'ANSWERABLE',
        risks:
          decision === QuestionReplyDecision.NEEDS_REVIEW
            ? ['MISSING_PRODUCT_DETAIL']
            : [],
        missingInformation:
          decision === QuestionReplyDecision.NEEDS_REVIEW
            ? ['Ürün ölçü tablosu']
            : [],
        evidenceIds: [`product:${productIds[index % productIds.length]}`],
        model: 'gemini-3.5-flash-lite',
        automationMode: AiAutomationMode.SAFE_AUTO,
        autoSendEligible: isAnswered && index !== 0,
        appliedConfidenceThreshold: 0.85,
        eligibilityReasons: isAnswered ? ['CONFIDENCE_THRESHOLD_MET'] : [],
        selectedAt: isAnswered ? new Date(createdAt.getTime() + 20_000) : null,
        finalizedAt: isAnswered ? new Date(createdAt.getTime() + 40_000) : null,
        createdAt: new Date(createdAt.getTime() + 12_000),
      });
      if (isAnswered) {
        answers.push({
          id: demoId('db', answerSequence++),
          storeId: store.id,
          connectionId: connection.id,
          questionId,
          requestedByUserId: demoUsers[workspaceIndex].id,
          draftAttemptId: draftId,
          origin:
            index === 0
              ? QuestionAnswerOrigin.MANUAL
              : QuestionAnswerOrigin.AUTOMATION,
          composition:
            index === 0
              ? QuestionAnswerComposition.AI_EDITED
              : QuestionAnswerComposition.AI_UNCHANGED,
          answer,
          status:
            workspaceIndex === 3 && index === 2
              ? QuestionAnswerStatus.FAILED
              : QuestionAnswerStatus.SENT,
          externalAnswerId: `demo-answer-${workspaceIndex}-${index}`,
          attempts: workspaceIndex === 3 && index === 2 ? 3 : 1,
          lastError:
            workspaceIndex === 3 && index === 2
              ? 'Pazaryeri geçici olarak yanıt vermedi.'
              : null,
          queuedAt: new Date(createdAt.getTime() + 20_000),
          sentAt:
            workspaceIndex === 3 && index === 2
              ? null
              : new Date(createdAt.getTime() + 40_000),
          createdAt: new Date(createdAt.getTime() + 20_000),
          updatedAt: new Date(createdAt.getTime() + 40_000),
        });
      }
    }
  });
  await transaction.incomingEvent.createMany({ data: incomingEvents });
  await transaction.productQuestion.createMany({ data: questions });
  await transaction.aiDraftAttempt.createMany({ data: drafts });
  await transaction.questionAnswer.createMany({ data: answers });

  const syncRuns: Prisma.CatalogSyncRunCreateManyInput[] = [];
  let syncSequence = 1;
  connections.forEach((connection, index) => {
    syncRuns.push({
      id: demoId('dc', syncSequence++),
      connectionId: connection.id,
      kind: CatalogSyncKind.FULL,
      status: CatalogSyncStatus.COMPLETED,
      trigger:
        index % 2 === 0
          ? CatalogSyncTrigger.SCHEDULED
          : CatalogSyncTrigger.MANUAL,
      stage: CatalogSyncStage.COMPLETED,
      progress: 100,
      productsProcessed:
        stores.find((store) => store.id === connection.storeId)?.productCount ??
        0,
      productsUpdated: 4 + (index % 12),
      productsUnchanged: 18 + (index % 40),
      batchesProcessed: 2 + (index % 6),
      fetchCompleted: true,
      variantsProcessed: 24 + (index % 60),
      questionsProcessed: 3 + (index % 8),
      startedAt: hoursAgo(now, 8 + index * 3),
      completedAt: hoursAgo(now, 7 + index * 3),
      createdAt: hoursAgo(now, 8 + index * 3),
      updatedAt: hoursAgo(now, 7 + index * 3),
    });
  });
  const failureConnection =
    connections.find((connection) => connection.workspaceIndex === 3) ??
    connections[0];
  syncRuns.push({
    id: demoId('dc', syncSequence++),
    connectionId: failureConnection.id,
    kind: CatalogSyncKind.INVENTORY,
    status: CatalogSyncStatus.FAILED,
    trigger: CatalogSyncTrigger.SCHEDULED,
    stage: CatalogSyncStage.FAILED,
    progress: 34,
    productsProcessed: 18,
    productsUpdated: 6,
    batchesProcessed: 1,
    fetchCompleted: false,
    errorMessage: 'Pazaryeri API bağlantısı zaman aşımına uğradı.',
    startedAt: hoursAgo(now, 5),
    completedAt: hoursAgo(now, 5),
    createdAt: hoursAgo(now, 5),
    updatedAt: hoursAgo(now, 5),
  });
  await transaction.catalogSyncRun.createMany({ data: syncRuns });

  const admin = await findAdmin(transaction);
  const tickets: string[] = [];
  for (let index = 0; index < ticketSeeds.length; index += 1) {
    const seed = ticketSeeds[index];
    const workspaceIndex = index % workspaceRows.length;
    const workspace = workspaceRows[workspaceIndex];
    const store = stores.find(
      (candidate) => candidate.workspaceIndex === workspaceIndex,
    )!;
    const createdAt = daysAgo(now, seed.ageDays);
    const respondedStatuses: SupportTicketStatus[] = [
      SupportTicketStatus.IN_PROGRESS,
      SupportTicketStatus.WAITING_CUSTOMER,
      SupportTicketStatus.RESOLVED,
      SupportTicketStatus.CLOSED,
    ];
    const firstResponded = respondedStatuses.includes(seed.status)
      ? new Date(createdAt.getTime() + 42 * 60 * 1000)
      : null;
    const resolvedAt =
      seed.status === SupportTicketStatus.RESOLVED ||
      seed.status === SupportTicketStatus.CLOSED
        ? new Date(createdAt.getTime() + 26 * 60 * 60 * 1000)
        : null;
    const closedAt =
      seed.status === SupportTicketStatus.CLOSED
        ? daysFrom(createdAt, 3)
        : null;
    const ticketId = demoId('dd', index + 1);
    tickets.push(ticketId);
    await transaction.supportTicket.create({
      data: {
        id: ticketId,
        workspaceId: workspace.id,
        storeId: store.id,
        createdByUserId: demoUsers[workspaceIndex].id,
        assignedAdminUserId: admin && index % 3 !== 0 ? admin.id : null,
        category: seed.category,
        impact: seed.impact,
        priority: seed.priority,
        status: seed.status,
        subject: seed.subject,
        planSnapshot: profiles[workspaceIndex].plan,
        context: {
          sourcePath: '/dashboard/support',
          browser: 'Chrome',
          seeded: true,
        },
        firstResponseDueAt: seed.overdue
          ? hoursAgo(now, 6 + index)
          : new Date(createdAt.getTime() + 8 * 60 * 60 * 1000),
        firstRespondedAt: firstResponded,
        lastMessageAt: resolvedAt ?? hoursAgo(now, index * 3 + 1),
        resolvedAt,
        closedAt,
        createdAt,
        updatedAt: resolvedAt ?? hoursAgo(now, index * 3 + 1),
      },
    });
    const baseMessage = index * 10;
    await transaction.supportMessage.createMany({
      data: [
        {
          id: demoId('de', baseMessage + 1),
          ticketId,
          authorUserId: demoUsers[workspaceIndex].id,
          authorType: SupportMessageAuthorType.CUSTOMER,
          body: `${seed.subject}. Konuyu kontrol edip nasıl ilerlemem gerektiğini paylaşabilir misiniz?`,
          createdAt,
        },
        ...(firstResponded
          ? [
              {
                id: demoId('de', baseMessage + 2),
                ticketId,
                authorUserId: admin?.id ?? null,
                authorType: SupportMessageAuthorType.SUPPORT,
                body: 'Merhaba, talebinizi incelemeye aldık. İlgili kayıtları kontrol edip size bilgi vereceğiz.',
                createdAt: firstResponded,
              },
              {
                id: demoId('de', baseMessage + 3),
                ticketId,
                authorUserId: demoUsers[workspaceIndex].id,
                authorType: SupportMessageAuthorType.CUSTOMER,
                body: 'Teşekkürler, gerekirse ek ekran görüntülerini de paylaşabilirim.',
                createdAt: new Date(firstResponded.getTime() + 70 * 60 * 1000),
              },
            ]
          : []),
        ...(resolvedAt
          ? [
              {
                id: demoId('de', baseMessage + 4),
                ticketId,
                authorUserId: admin?.id ?? null,
                authorType: SupportMessageAuthorType.SUPPORT,
                body: 'Gerekli kontroller tamamlandı ve sorun giderildi. Başka bir konuda yardımcı olabiliriz.',
                createdAt: resolvedAt,
              },
            ]
          : []),
      ],
    });
  }

  const notifications: Prisma.NotificationCreateManyInput[] = [];
  demoUsers.forEach((user, index) => {
    const workspaceIndex = Math.min(index, workspaceRows.length - 1);
    const store = stores.find(
      (candidate) => candidate.workspaceIndex === workspaceIndex,
    );
    notifications.push({
      id: demoId('df', index * 10 + 1),
      recipientUserId: user.id,
      storeId: store?.id,
      type:
        index % 3 === 0
          ? NotificationType.AI_REVIEW_REQUIRED
          : NotificationType.LOW_STOCK,
      severity:
        index % 3 === 0
          ? NotificationSeverity.WARNING
          : NotificationSeverity.INFO,
      title:
        index % 3 === 0
          ? 'AI yanıtı inceleme bekliyor'
          : 'Bazı ürünlerin stoğu azalıyor',
      message:
        index % 3 === 0
          ? 'Bir müşteri sorusu güven eşiğinin altında kaldı ve incelemenizi bekliyor.'
          : 'Stok adedi kritik seviyeye yaklaşan ürünler bulunuyor.',
      actionUrl:
        index % 3 === 0 ? '/dashboard/inbox' : '/dashboard/catalog/inventory',
      entityType: 'DEMO_DATA',
      entityId: store?.id,
      dedupeKey: `demo-notification-${index}-1`,
      readAt: index % 4 === 0 ? hoursAgo(now, 2) : null,
      lastOccurredAt: hoursAgo(now, index + 1),
      createdAt: daysAgo(now, index % 6),
      updatedAt: hoursAgo(now, index + 1),
    });
  });
  if (profiles[3] && stores.find((store) => store.workspaceIndex === 3)) {
    notifications.push({
      id: demoId('df', 999),
      recipientUserId: demoUsers[3].id,
      storeId: stores.find((store) => store.workspaceIndex === 3)!.id,
      type: NotificationType.BILLING_PAYMENT_ISSUE,
      severity: NotificationSeverity.ERROR,
      title: 'Ödeme yenilenemedi',
      message: 'Abonelik ödemeniz alınamadı. Ödeme yönteminizi kontrol edin.',
      actionUrl: `/billing/${workspaceRows[3].id}`,
      entityType: 'BILLING_SUBSCRIPTION',
      entityId: subscriptionIds[3],
      dedupeKey: 'demo-payment-issue',
      lastOccurredAt: hoursAgo(now, 3),
      createdAt: hoursAgo(now, 3),
      updatedAt: hoursAgo(now, 3),
    });
  }
  await transaction.notification.createMany({ data: notifications });

  await transaction.auditLog.createMany({
    data: workspaceRows.map((workspace, index) => ({
      id: demoId('c3', index + 1),
      actorType: index % 2 === 0 ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorUserId: index % 2 === 0 ? demoUsers[index].id : null,
      actorName: index % 2 === 0 ? demoUsers[index].name : 'Core Asistan',
      actorEmail: index % 2 === 0 ? demoUsers[index].email : null,
      origin: index % 2 === 0 ? AuditOrigin.API : AuditOrigin.SCHEDULED,
      action: index === 3 ? 'CATALOG_SYNC_FAILED' : 'DEMO_ACCOUNT_ACTIVITY',
      result: index === 3 ? AuditResult.FAILURE : AuditResult.SUCCESS,
      workspaceId: workspace.id,
      storeId: stores.find((store) => store.workspaceIndex === index)?.id,
      targetType: 'DEMO_DATA',
      targetId: workspace.id,
      errorCode: index === 3 ? 'MARKETPLACE_TIMEOUT' : null,
      metadata: {
        seeded: true,
        description: 'Gerçekçi admin paneli demo verisi',
      },
      createdAt: hoursAgo(now, index * 5 + 1),
    })),
  });

  return {
    preservedUsers,
    demoUsers: demoUsers.length,
    workspaces: workspaceRows.length,
    stores: stores.length,
    products: products.length,
    questions: questions.length,
    tickets: tickets.length,
  };
}

async function findAdmin(transaction: Prisma.TransactionClient) {
  const configuredEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!configuredEmails.length) return null;
  return transaction.user.findFirst({
    where: {
      emailVerified: true,
      OR: configuredEmails.map((email) => ({
        email: { equals: email, mode: 'insensitive' as const },
      })),
    },
    select: { id: true },
  });
}

async function databaseSummary(prisma: PrismaClient) {
  const [users, workspaces, stores, products, questions, tickets] =
    await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.store.count(),
      prisma.product.count(),
      prisma.productQuestion.count(),
      prisma.supportTicket.count(),
    ]);
  return { users, workspaces, stores, products, questions, tickets };
}

async function createManyInChunks<T>(
  records: T[],
  create: (records: T[]) => Promise<unknown>,
) {
  for (let offset = 0; offset < records.length; offset += 250) {
    await create(records.slice(offset, offset + 250));
  }
}

function splitQuantity(total: number, parts: number) {
  if (total <= 0) return Array.from({ length: parts }, () => 0);
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from(
    { length: parts },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

function demoId(prefix: string, sequence: number) {
  return `${prefix}000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
}

function daysAgo(reference: Date, days: number) {
  return new Date(reference.getTime() - days * DAY_MS);
}

function daysFrom(reference: Date, days: number) {
  return new Date(reference.getTime() + days * DAY_MS);
}

function hoursAgo(reference: Date, hours: number) {
  return new Date(reference.getTime() - hours * 60 * 60 * 1000);
}

function requiredDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL tanımlı değil.');
  return value;
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error('Demo verisi production ortamında oluşturulamaz.');
  }
  if (process.env.PADDLE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error('PADDLE_ENV=production iken demo verisi oluşturulamaz.');
  }
}

void run().catch((error: unknown) => {
  console.error('\nDemo verisi oluşturulamadı.');
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
