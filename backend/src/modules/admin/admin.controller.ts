import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminOverviewService } from './admin-overview.service';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly overviewService: AdminOverviewService) {}

  @Get('session')
  getSession(@CurrentUser() user: AuthenticatedUser) {
    return {
      role: 'ADMIN' as const,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image ?? null,
      },
    };
  }

  @Get('header-summary')
  getHeaderSummary() {
    return this.overviewService.getHeaderSummary();
  }
}
