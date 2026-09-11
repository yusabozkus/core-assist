import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import {
  TeamController,
  WorkspaceInvitationsController,
} from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [TeamController, WorkspaceInvitationsController],
  providers: [TeamService],
})
export class TeamModule {}
