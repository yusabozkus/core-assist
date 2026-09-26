import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ResendWebhookService } from './resend-webhook.service';

@Controller('notifications/webhooks')
export class ResendWebhookController {
  constructor(private readonly webhooks: ResendWebhookService) {}

  @Post('resend')
  @HttpCode(200)
  receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('svix-id') id?: string,
    @Headers('svix-timestamp') timestamp?: string,
    @Headers('svix-signature') signature?: string,
  ) {
    if (!request.rawBody)
      throw new BadRequestException('Webhook gövdesi okunamadı.');
    return this.webhooks.receive(request.rawBody, { id, timestamp, signature });
  }
}
