import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { SIZE_GUIDE_QUEUE } from './size-guide.constants';
import { SizeGuideImageService } from './size-guide-image.service';
import { SizeGuideProcessor } from './size-guide.processor';
import { SizeGuideQueueService } from './size-guide-queue.service';
import { SizeGuideDispatcher } from './size-guide.types';
import { SizeGuideWorkerService } from './size-guide-worker.service';

@Module({
  imports: [
    AiModule,
    BillingModule,
    BullModule.registerQueue({ name: SIZE_GUIDE_QUEUE }),
  ],
  providers: [
    SizeGuideImageService,
    SizeGuideQueueService,
    SizeGuideWorkerService,
    SizeGuideProcessor,
    { provide: SizeGuideDispatcher, useExisting: SizeGuideQueueService },
  ],
  exports: [SizeGuideDispatcher],
})
export class SizeGuideModule {}
