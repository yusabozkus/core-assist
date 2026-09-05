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
import { getRedisConnection } from './infrastructure/queue/redis-connection';

@Module({
  imports: [
    BullModule.forRoot({ connection: getRedisConnection() }),
    PrismaModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
