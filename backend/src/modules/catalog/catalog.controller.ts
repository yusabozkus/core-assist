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
import { CatalogService } from './catalog.service';
import { CatalogInventoryQueryDto } from './catalog-inventory-query.dto';
import { CatalogProductsQueryDto } from './catalog-products-query.dto';

@Controller('stores/:storeId/catalog')
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  findProducts(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogProductsQueryDto,
  ) {
    return this.catalogService.findProducts(storeId, user.id, query);
  }

  @Get('inventory')
  findInventory(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CatalogInventoryQueryDto,
  ) {
    return this.catalogService.findInventory(storeId, user.id, query);
  }

  @Get('products/:productId')
  findProduct(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.catalogService.findProduct(storeId, productId, user.id);
  }
}
