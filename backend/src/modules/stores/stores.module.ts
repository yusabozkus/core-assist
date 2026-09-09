import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';

import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AuthModule, BillingModule],
  controllers: [StoresController],
  providers: [StoresService],
})
export class StoresModule {}
