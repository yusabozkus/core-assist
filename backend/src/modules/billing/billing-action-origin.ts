import { ForbiddenException } from '@nestjs/common';

export function assertBillingActionOrigin(origin: string | undefined) {
  const configured = process.env.FRONTEND_URL?.trim();
  const allowed = new Set(configured ? [new URL(configured).origin] : []);
  if (process.env.NODE_ENV !== 'production')
    allowed.add('http://localhost:3001');
  if (!origin || !allowed.has(origin))
    throw new ForbiddenException('İşlem kaynağı doğrulanamadı.');
}
