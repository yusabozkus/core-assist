import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  TeamController,
  WorkspaceInvitationsController,
} from './team.controller';
import { TeamService } from './team.service';
import { TeamInvitationEmailService } from './team-invitation-email.service';
import { TeamEventEmailService } from './team-event-email.service';

@Module({
  imports: [AuthModule, BillingModule, NotificationsModule],
  controllers: [TeamController, WorkspaceInvitationsController],
  providers: [TeamService, TeamInvitationEmailService, TeamEventEmailService],
})
export class TeamModule {}
