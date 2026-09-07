import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ProductSyncModule } from '../product-sync/product-sync.module';
import { QuestionSyncModule } from '../question-sync/question-sync.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    IntegrationsModule,
    ProductSyncModule,
    QuestionSyncModule,
    NotificationsModule,
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
