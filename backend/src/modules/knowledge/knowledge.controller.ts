import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpdateStoreKnowledgeDto } from './dto/update-store-knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('stores/:storeId/knowledge')
@UseGuards(AuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  findOne(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledge.findOne(storeId, user.id);
  }

  @Put()
  update(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Body() dto: UpdateStoreKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.knowledge.update(storeId, user.id, dto);
  }
}
