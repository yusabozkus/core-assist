import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpdateSetupGuideDto } from './dto/update-setup-guide.dto';
import { SetupGuideService } from './setup-guide.service';

@Controller('stores/:storeId/setup-guide')
@UseGuards(AuthGuard)
export class SetupGuideController {
  constructor(private readonly setupGuide: SetupGuideService) {}

  @Get()
  get(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.setupGuide.get(storeId, user.id);
  }

  @Patch()
  update(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSetupGuideDto,
  ) {
    return this.setupGuide.update(storeId, user.id, dto);
  }
}
