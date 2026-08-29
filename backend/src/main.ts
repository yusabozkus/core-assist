import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredFrontendURL = process.env.FRONTEND_URL?.trim();

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

  app.enableCors({
    origin: [...allowedOrigins],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
    ],
  });

  const port = process.env.PORT ?? 4001;
  await app.listen(port);
  console.log(`🚀 Backend çalışıyor: http://localhost:${port}`);
  console.log(`🔐 Better Auth API: http://localhost:${port}/api/auth`);
}
void bootstrap();
