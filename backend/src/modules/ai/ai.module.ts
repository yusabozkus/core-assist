import { Module } from '@nestjs/common';
import { AiDraftGenerator } from './ai-draft.types';
import { GeminiClientService } from './gemini-client.service';
import { GeminiDraftService } from './gemini-draft.service';

@Module({
  providers: [
    GeminiClientService,
    GeminiDraftService,
    { provide: AiDraftGenerator, useExisting: GeminiDraftService },
  ],
  exports: [AiDraftGenerator, GeminiClientService],
})
export class AiModule {}
