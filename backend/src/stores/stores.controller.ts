import { Controller, Get, Post, Body, Param, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('stores')
@UseGuards(AuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  create(
    @CurrentUser() user: any,
    @Body() createStoreDto: CreateStoreDto,
  ) {
    if (!createStoreDto.workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }
    return this.storesService.create(user.id, createStoreDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('workspaceId') workspaceId: string,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId query parameter is required');
    }
    return this.storesService.findAllForWorkspace(workspaceId, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.storesService.findOne(id, user.id);
  }
}
