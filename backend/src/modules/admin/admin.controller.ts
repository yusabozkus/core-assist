import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminOverviewService } from './admin-overview.service';
import { AdminGlobalSearchService } from './admin-global-search.service';
import { AdminGlobalSearchQueryDto } from './dto/admin-global-search-query.dto';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly overviewService: AdminOverviewService,
    private readonly globalSearch: AdminGlobalSearchService,
  ) {}

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

  @Get('search')
  search(@Query() query: AdminGlobalSearchQueryDto) {
    return this.globalSearch.search(query);
  }

  @Get('overview')
  getOverview() {
    return this.overviewService.getOverview();
  }
}
