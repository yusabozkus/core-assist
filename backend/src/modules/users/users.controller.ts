import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type {
  AuthenticatedSession,
  AuthenticatedUser,
} from '../auth/auth.types';
import { CurrentSession } from '../auth/current-session.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import { AccountDeletionService } from './account-deletion.service';
import {
  CloseAccountBillingDto,
  DeleteAccountDto,
} from './dto/delete-account.dto';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accountDeletion: AccountDeletionService,
  ) {}

  @Get('me/deletion-status')
  getDeletionStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.accountDeletion.getStatus(user.id);
  }

  @Post('me/close-billing')
  closeBilling(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSession() session: AuthenticatedSession,
    @Headers('origin') origin: string | undefined,
    @Body() input: CloseAccountBillingDto,
  ) {
    assertAccountActionOrigin(origin);
    if (input.confirmation !== 'TAHSİLATI DURDUR')
      throw new ForbiddenException('İptal onayı gerekli.');
    return this.accountDeletion.closeBilling(user.id, session.id);
  }

  @Post('me/delete')
  deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSession() session: AuthenticatedSession,
    @Headers('origin') origin: string | undefined,
    @Body() input: DeleteAccountDto,
  ) {
    assertAccountActionOrigin(origin);
    if (input.confirmation !== 'HESABIMI SİL')
      throw new ForbiddenException('Hesap silme onayı gerekli.');
    return this.accountDeletion.deleteAccount(user.id, session.id);
  }

  @Get('me')
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Get('me/account-overview')
  getAccountOverview(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSession() session: AuthenticatedSession,
  ) {
    return this.usersService.getAccountOverview(user.id, session.id);
  }

  @Get('me/export')
  exportAccountData(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.exportAccountData(user.id);
  }
}

function assertAccountActionOrigin(origin: string | undefined) {
  const configured = process.env.FRONTEND_URL?.trim();
  const allowed = new Set(configured ? [new URL(configured).origin] : []);
  if (process.env.NODE_ENV !== 'production')
    allowed.add('http://localhost:3001');
  if (!origin || !allowed.has(origin))
    throw new ForbiddenException('İşlem kaynağı doğrulanamadı.');
}
