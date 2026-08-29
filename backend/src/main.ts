import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3001',
      'http://localhost:3001',
      'http://localhost:4001',
    ],
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
bootstrap();
