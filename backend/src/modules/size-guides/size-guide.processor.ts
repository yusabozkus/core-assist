import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  EXTRACT_SIZE_GUIDE_JOB,
  SIZE_GUIDE_QUEUE,
} from './size-guide.constants';
import type { SizeGuideExtractionJobData } from './size-guide.types';
import { SizeGuideWorkerService } from './size-guide-worker.service';

@Processor(SIZE_GUIDE_QUEUE, { concurrency: 1 })
export class SizeGuideProcessor extends WorkerHost {
  constructor(private readonly extractionWorker: SizeGuideWorkerService) {
    super();
  }

  async process(job: Job<SizeGuideExtractionJobData>) {
    if (job.name !== EXTRACT_SIZE_GUIDE_JOB) {
      throw new Error(`Unsupported size guide job: ${job.name}`);
    }

    await this.extractionWorker.extract(job.data.sizeGuideId);
  }
}
