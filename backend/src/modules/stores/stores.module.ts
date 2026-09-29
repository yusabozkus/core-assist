import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';
import { SetupGuideController } from './setup-guide.controller';
import { SetupGuideService } from './setup-guide.service';

import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, AuthModule, BillingModule],
  controllers: [StoresController, SetupGuideController],
  providers: [StoresService, SetupGuideService],
})
export class StoresModule {}
