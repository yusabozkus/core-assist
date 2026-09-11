import { Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { BillingAuthorizationService } from './billing-authorization.service';
import { assertBillingActionOrigin } from './billing-action-origin';

@Controller('billing/workspaces')
@UseGuards(AuthGuard)
export class BillingWorkspacesController {
  constructor(
    private readonly authorization: BillingAuthorizationService,
    private readonly workspaces: WorkspacesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.authorization.listWorkspaces(user.id);
  }

  @Post()
  async prepare(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    const workspace = await this.workspaces.getOrCreateOwnedWorkspace(user.id);
    return { id: workspace.id, name: workspace.name };
  }
}
