import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateWorkspaceInvitationDto,
  UpdateWorkspaceMemberDto,
} from './dto/team-member-access.dto';
import { TeamService } from './team.service';

@Controller('workspaces/:workspaceId/team')
@UseGuards(AuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  getTeam(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamService.getTeam(workspaceId, user.id);
  }

  @Post('invitations')
  createInvitation(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceInvitationDto,
  ) {
    return this.teamService.createInvitation(workspaceId, user.id, dto);
  }

  @Post('invitations/:invitationId/link')
  renewInvitationLink(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamService.renewInvitationLink(
      workspaceId,
      invitationId,
      user.id,
    );
  }

  @Delete('invitations/:invitationId')
  revokeInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamService.revokeInvitation(
      workspaceId,
      invitationId,
      user.id,
    );
  }

  @Patch('members/:userId')
  updateMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceMemberDto,
  ) {
    return this.teamService.updateMember(
      workspaceId,
      targetUserId,
      user.id,
      dto,
    );
  }

  @Delete('members/:userId')
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamService.removeMember(workspaceId, targetUserId, user.id);
  }
}

@Controller('workspace-invitations')
export class WorkspaceInvitationsController {
  constructor(private readonly teamService: TeamService) {}

  @Get(':token')
  getInvitation(@Param('token') token: string) {
    return this.teamService.getInvitation(token);
  }

  @Post(':token/accept')
  @UseGuards(AuthGuard)
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamService.acceptInvitation(token, user);
  }
}
