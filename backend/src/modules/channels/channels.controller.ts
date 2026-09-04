import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ChannelsService } from './channels.service';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';
import { ConfigureChannelConnectionDto } from './dto/configure-channel-connection.dto';
import { SyncHistoryQueryDto } from './dto/sync-history-query.dto';

@Controller('stores/:storeId/channels')
@UseGuards(AuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('providers/available')
  findAvailableProviders(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.findAvailableProviders(storeId, user.id);
  }

  @Get('sync-runs')
  findSyncHistory(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SyncHistoryQueryDto,
  ) {
    return this.channelsService.findSyncHistory(storeId, user.id, query);
  }

  @Get('sync-runs/:syncRunId')
  findSyncRun(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('syncRunId', new ParseUUIDPipe()) syncRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.findSyncRun(storeId, syncRunId, user.id);
  }

  @Post('sync-runs/:syncRunId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  retrySyncRun(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('syncRunId', new ParseUUIDPipe()) syncRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.retrySyncRun(storeId, syncRunId, user.id);
  }

  @Get()
  findAll(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.findAll(storeId, user.id);
  }

  @Put(':connectionId')
  configure(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfigureChannelConnectionDto,
  ) {
    return this.channelsService.configure(storeId, connectionId, user.id, dto);
  }

  @Post(':connectionId/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  syncCatalog(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.syncCatalog(storeId, connectionId, user.id);
  }

  @Post(':connectionId/inventory-sync')
  @HttpCode(HttpStatus.ACCEPTED)
  syncInventory(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.syncInventory(storeId, connectionId, user.id);
  }

  @Post()
  create(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChannelConnectionDto,
  ) {
    return this.channelsService.create(storeId, user.id, dto);
  }

  @Patch(':connectionId/disconnect')
  disconnect(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.disconnect(storeId, connectionId, user.id);
  }

  @Patch(':connectionId/reconnect')
  reconnect(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.reconnect(storeId, connectionId, user.id);
  }

  @Delete(':connectionId')
  remove(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.remove(storeId, connectionId, user.id);
  }
}
