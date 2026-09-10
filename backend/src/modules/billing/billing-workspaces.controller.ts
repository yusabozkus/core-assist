import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateWorkspaceDto } from '../workspaces/dto/create-workspace.dto';
import { BillingAuthorizationService } from './billing-authorization.service';
import { assertBillingActionOrigin } from './billing-action-origin';

@Controller('billing/workspaces')
@UseGuards(AuthGuard)
export class BillingWorkspacesController {
  constructor(
    private readonly authorization: BillingAuthorizationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.authorization.listWorkspaces(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateWorkspaceDto,
    @Headers('origin') origin: string | undefined,
  ) {
    assertBillingActionOrigin(origin);
    return this.prisma.$transaction(async (transaction) => {
      // Share the onboarding lock: retries/two tabs must reuse the same workspace.
      await transaction.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${user.id} FOR UPDATE`;
      const existing = await transaction.workspace.findFirst({
        where: { ownerId: user.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, name: true },
      });
      if (existing) return existing;
      // No store, trial reset or onboarding completion is performed here.
      return transaction.workspace.create({
        data: {
          name: input.name,
          ownerId: user.id,
          members: { create: { userId: user.id, role: WorkspaceRole.OWNER } },
        },
        select: { id: true, name: true },
      });
    });
  }
}
