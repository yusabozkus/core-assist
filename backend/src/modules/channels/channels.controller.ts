import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ChannelsService } from './channels.service';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';

@Controller('stores/:storeId/channels')
@UseGuards(AuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  findAll(
    @Param('storeId', new ParseUUIDPipe()) storeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.channelsService.findAll(storeId, user.id);
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
