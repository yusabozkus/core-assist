import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('stores')
@UseGuards(AuthGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createStoreDto: CreateStoreDto,
  ) {
    return this.storesService.create(user.id, createStoreDto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findOne(id, user.id);
  }
}
