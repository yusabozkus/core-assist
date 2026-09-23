import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { BILLING_RECOVERY_QUEUE } from '../billing/billing-reconciliation.processor';
import { PADDLE_WEBHOOK_QUEUE } from '../billing/paddle-webhook.constants';
import { ChannelsModule } from '../channels/channels.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PRODUCT_SYNC_QUEUE } from '../product-sync/product-sync.constants';
import { QUESTION_ANSWER_QUEUE } from '../question-answer/question-answer.constants';
import { QUESTION_SYNC_QUEUE } from '../question-sync/question-sync.constants';
import { QUESTION_DRAFT_QUEUE } from '../questions/question-draft.constants';
import { SIZE_GUIDE_QUEUE } from '../size-guides/size-guide.constants';
import { SupportModule } from '../support/support.module';
import { SUPPORT_NOTIFICATION_QUEUE } from '../support/support-notification.constants';
import { DATA_RETENTION_QUEUE } from '../data-retention/data-retention.constants';
import { NOTIFICATION_EMAIL_DIGEST_QUEUE } from '../notifications/notification-email-digest.constants';
import { AdminAccessService } from './admin-access.service';
import { AdminActionOriginGuard } from './admin-action-origin.guard';
import { AdminBillingController } from './admin-billing.controller';
import { AdminBillingService } from './admin-billing.service';
import { AdminController } from './admin.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminGuard } from './admin.guard';
import { AdminOverviewService } from './admin-overview.service';
import { AdminOperationsController } from './admin-operations.controller';
import { AdminOperationsService } from './admin-operations.service';
import { AdminSupportController } from './admin-support.controller';
import { AdminSupportService } from './admin-support.service';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AdminAuditLogsService } from './admin-audit-logs.service';
import { AdminAiUsageService } from './admin-ai-usage.service';
import { AdminInsightsController } from './admin-insights.controller';
import { AdminSystemHealthService } from './admin-system-health.service';
import { AdminGlobalSearchService } from './admin-global-search.service';
import { AdminContactMessagesController } from './admin-contact-messages.controller';
import { AdminContactMessagesService } from './admin-contact-messages.service';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    ChannelsModule,
    IntegrationsModule,
    SupportModule,
    BullModule.registerQueue(
      { name: PRODUCT_SYNC_QUEUE },
      { name: QUESTION_SYNC_QUEUE },
      { name: QUESTION_DRAFT_QUEUE },
      { name: QUESTION_ANSWER_QUEUE },
      { name: SIZE_GUIDE_QUEUE },
      { name: PADDLE_WEBHOOK_QUEUE },
      { name: BILLING_RECOVERY_QUEUE },
      { name: SUPPORT_NOTIFICATION_QUEUE },
      { name: NOTIFICATION_EMAIL_DIGEST_QUEUE },
      { name: DATA_RETENTION_QUEUE },
    ),
  ],
  controllers: [
    AdminAuditLogsController,
    AdminInsightsController,
    AdminController,
    AdminBillingController,
    AdminCustomersController,
    AdminOperationsController,
    AdminSupportController,
    AdminContactMessagesController,
  ],
  providers: [
    AdminAuditLogsService,
    AdminAiUsageService,
    AdminAccessService,
    AdminActionOriginGuard,
    AdminBillingService,
    AdminGuard,
    AdminCustomersService,
    AdminOverviewService,
    AdminOperationsService,
    AdminSupportService,
    AdminContactMessagesService,
    AdminSystemHealthService,
    AdminGlobalSearchService,
  ],
  exports: [AdminAccessService, AdminGuard],
})
export class AdminModule {}
