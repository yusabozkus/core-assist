import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DATA_RETENTION_QUEUE } from './data-retention.constants';
import { DataRetentionProcessor } from './data-retention.processor';
import { DataRetentionService } from './data-retention.service';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [
    SupportModule,
    BullModule.registerQueue({ name: DATA_RETENTION_QUEUE }),
  ],
  providers: [DataRetentionProcessor, DataRetentionService],
})
export class DataRetentionModule {}
