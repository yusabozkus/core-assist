import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { StoresModule } from './stores/stores.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkspacesModule,
    StoresModule,
    OnboardingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
