import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { createHttpLoggingMiddleware } from './infrastructure/logging/http-logging.middleware';
import { RequestContextInterceptor } from './infrastructure/logging/request-context.interceptor';
import { StructuredLogger } from './infrastructure/logging/structured-logger';

const logger = new StructuredLogger();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    logger,
  });
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredFrontendURL = process.env.FRONTEND_URL?.trim();
  const trustProxyHops = parseTrustProxyHops(process.env.TRUST_PROXY_HOPS);

  if (trustProxyHops !== null) {
    app.set('trust proxy', trustProxyHops);
  }

  if (isProduction && !configuredFrontendURL) {
    throw new Error(
      'FRONTEND_URL environment variable is required in production.',
    );
  }

  const allowedOrigins = new Set([
    configuredFrontendURL || 'http://localhost:3001',
  ]);

  if (!isProduction) {
    allowedOrigins.add('http://localhost:3001');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.use(createHttpLoggingMiddleware(logger));
  app.useGlobalInterceptors(new RequestContextInterceptor());

  app.enableCors({
    origin: [...allowedOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
  });

  const port = process.env.PORT ?? 4001;
  await app.listen(port);
  logger.log(
    {
      message: 'Backend started.',
      port,
      authPath: '/api/auth',
    },
    'Bootstrap',
  );
}

function parseTrustProxyHops(value: string | undefined) {
  if (!value?.trim()) return null;
  const hops = Number(value);
  if (!Number.isSafeInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10.');
  }
  return hops;
}

void bootstrap().catch((error: unknown) => {
  logger.fatal(
    'Backend could not start.',
    error instanceof Error ? error.stack : error,
    'Bootstrap',
  );
  process.exitCode = 1;
});
