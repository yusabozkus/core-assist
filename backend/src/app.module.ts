import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { StoresModule } from './modules/stores/stores.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { UsersModule } from './modules/users/users.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SearchModule } from './modules/search/search.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BillingModule } from './modules/billing/billing.module';
import { getRedisConnection } from './infrastructure/queue/redis-connection';
import { TeamModule } from './modules/team/team.module';
import { SupportModule } from './modules/support/support.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { DataRetentionModule } from './modules/data-retention/data-retention.module';
import { ContactModule } from './modules/contact/contact.module';
import { ActivityModule } from './modules/activity/activity.module';
import { RuntimeModule } from './infrastructure/runtime/runtime.module';
import { LandingDemoModule } from './modules/landing-demo/landing-demo.module';

@Module({
  imports: [
    RuntimeModule,
    BullModule.forRoot({ connection: getRedisConnection() }),
    PrismaModule,
    AuditModule,
    ActivityModule,
    AuthModule,
    WorkspacesModule,
    StoresModule,
    OnboardingModule,
    UsersModule,
    ChannelsModule,
    CatalogModule,
    QuestionsModule,
    KnowledgeModule,
    AnalyticsModule,
    DashboardModule,
    SearchModule,
    NotificationsModule,
    BillingModule,
    TeamModule,
    SupportModule,
    DataRetentionModule,
    ContactModule,
    LandingDemoModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
