import {
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { DeleteStoreDto } from './dto/delete-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
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

  @Get('archived')
  findArchived(@CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findArchivedForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.storesService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateStoreDto: UpdateStoreDto,
  ) {
    return this.storesService.update(id, user.id, updateStoreDto);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.storesService.archive(id, user.id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.storesService.restore(id, user.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() deleteStoreDto: DeleteStoreDto,
  ) {
    return this.storesService.remove(id, user.id, deleteStoreDto);
  }
}
