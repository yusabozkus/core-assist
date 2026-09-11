import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaddleBillingService } from './paddle-billing.service';
import { PaddleWebhookQueueService } from './paddle-webhook-queue.service';

@Controller('billing/webhooks')
export class PaddleWebhookController {
  constructor(
    private readonly paddleBilling: PaddleBillingService,
    private readonly webhookQueue: PaddleWebhookQueueService,
  ) {}

  @Post('paddle')
  @HttpCode(HttpStatus.OK)
  async handlePaddleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('paddle-signature') signature?: string,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Webhook gövdesi okunamadı.');
    }

    const event = await this.paddleBilling.verifyWebhook(
      request.rawBody.toString('utf8'),
      signature,
    );

    return this.webhookQueue.enqueue(event);
  }
}
