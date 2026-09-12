import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { NotificationCoreModule } from '../notifications/notification-core.module';

@Module({
  imports: [PrismaModule, NotificationCoreModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
