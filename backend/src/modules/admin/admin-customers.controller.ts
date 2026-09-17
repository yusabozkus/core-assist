import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AdminCustomersService } from './admin-customers.service';
import { AdminGuard } from './admin.guard';
import { AdminCustomersQueryDto } from './dto/admin-customers-query.dto';

@Controller('admin/customers')
@UseGuards(AuthGuard, AdminGuard)
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  findAll(@Query() query: AdminCustomersQueryDto) {
    return this.customers.findAll(query);
  }

  @Get(':workspaceId')
  findOne(@Param('workspaceId', new ParseUUIDPipe()) workspaceId: string) {
    return this.customers.findOne(workspaceId);
  }
}
