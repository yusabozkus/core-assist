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

@Controller('billing/webhooks')
export class PaddleWebhookController {
  constructor(private readonly paddleBilling: PaddleBillingService) {}

  @Post('paddle')
  @HttpCode(HttpStatus.OK)
  handlePaddleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('paddle-signature') signature?: string,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException('Webhook gövdesi okunamadı.');
    }

    return this.paddleBilling.handleWebhook(
      request.rawBody.toString('utf8'),
      signature,
    );
  }
}
