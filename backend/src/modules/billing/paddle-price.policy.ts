import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Paddle, Price } from '@paddle/paddle-node-sdk';
import { BillingCycle } from '../../generated/prisma/enums';

type RecurringPrice = Pick<
  Price,
  'id' | 'status' | 'billingCycle' | 'trialPeriod'
>;

export async function requirePaidRecurringPrice(
  client: Paddle,
  priceId: string,
  cycle: BillingCycle,
) {
  let price: Price;
  try {
    price = await client.prices.get(priceId);
  } catch {
    throw new BadGatewayException({
      code: 'PADDLE_PRICE_UNAVAILABLE',
      message:
        'Plan fiyatı Paddle üzerinden doğrulanamadı. Lütfen daha sonra tekrar deneyin.',
    });
  }

  assertPaidRecurringPrice(price, priceId, cycle);
}

export function assertPaidRecurringPrice(
  price: RecurringPrice,
  priceId: string,
  cycle: BillingCycle,
) {
  const expectedInterval = cycle === BillingCycle.MONTHLY ? 'month' : 'year';
  if (
    price.id !== priceId ||
    price.status !== 'active' ||
    price.billingCycle?.frequency !== 1 ||
    price.billingCycle.interval !== expectedInterval ||
    price.trialPeriod !== null
  ) {
    throw new ServiceUnavailableException({
      code: 'PADDLE_PRICE_CONFIGURATION_INVALID',
      message:
        'Paddle plan fiyatı geçersiz yapılandırılmış. Ücretli plan fiyatlarında deneme süresi bulunmamalıdır.',
    });
  }
}
