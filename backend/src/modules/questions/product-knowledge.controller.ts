import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpdateProductKnowledgeDto } from './dto/update-product-knowledge.dto';
import { ProductKnowledgeService } from './product-knowledge.service';

@Controller('stores/:storeId/product-knowledge')
@UseGuards(AuthGuard)
export class ProductKnowledgeController {
  constructor(private readonly productKnowledge: ProductKnowledgeService) {}

  @Patch(':factId')
  update(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('factId', new ParseUUIDPipe()) factId: string,
    @Body() body: UpdateProductKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productKnowledge.updateFact(storeId, factId, user.id, body);
  }

  @Delete(':factId')
  @HttpCode(HttpStatus.OK)
  archive(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('factId', new ParseUUIDPipe()) factId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productKnowledge.archiveFact(storeId, factId, user.id);
  }
}
