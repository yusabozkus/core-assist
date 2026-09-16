import { ForbiddenException } from '@nestjs/common';

export function assertAdminActionOrigin(origin: string | undefined) {
  const configured = process.env.FRONTEND_URL?.trim();
  const allowedOrigins = new Set(
    configured ? [new URL(configured).origin] : [],
  );

  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:3001');
  }

  if (!origin || !allowedOrigins.has(origin)) {
    throw new ForbiddenException('İşlem kaynağı doğrulanamadı.');
  }
}
