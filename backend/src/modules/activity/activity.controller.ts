import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ActivityQueryDto } from './activity-query.dto';
import { ActivityService } from './activity.service';

@Controller('stores/:storeId/activity')
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ActivityQueryDto,
  ) {
    return this.activity.list(storeId, user.id, query);
  }
}
