import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SizeGuideModule } from '../size-guides/size-guide.module';
import {
  PRODUCT_SYNC_DISPATCHER,
  PRODUCT_SYNC_QUEUE,
} from './product-sync.constants';
import { ProductSyncProcessor } from './product-sync.processor';
import { ProductSyncQueueService } from './product-sync-queue.service';
import { ProductSyncSchedulerService } from './product-sync-scheduler.service';
import { ProductSyncWorkerService } from './product-sync-worker.service';

@Module({
  imports: [
    IntegrationsModule,
    SizeGuideModule,
    BullModule.registerQueue({ name: PRODUCT_SYNC_QUEUE }),
  ],
  providers: [
    ProductSyncQueueService,
    {
      provide: PRODUCT_SYNC_DISPATCHER,
      useExisting: ProductSyncQueueService,
    },
    ProductSyncWorkerService,
    ProductSyncProcessor,
    ProductSyncSchedulerService,
  ],
  exports: [PRODUCT_SYNC_DISPATCHER],
})
export class ProductSyncModule {}
