import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CompleteOnboardingDto,
  ProvisionOnboardingDto,
} from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getStatus(user.id);
  }

  @Get('stores/:storeId/status')
  getAdditionalStoreStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ) {
    return this.onboardingService.getAdditionalStoreStatus(user.id, storeId);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() completeOnboardingDto: CompleteOnboardingDto,
  ) {
    return this.onboardingService.complete(user.id, completeOnboardingDto);
  }

  @Post('stores/complete')
  @HttpCode(HttpStatus.OK)
  completeAdditionalStore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() completeOnboardingDto: CompleteOnboardingDto,
  ) {
    return this.onboardingService.completeAdditionalStore(
      user.id,
      completeOnboardingDto,
    );
  }

  @Post('provision')
  @HttpCode(HttpStatus.OK)
  provision(
    @CurrentUser() user: AuthenticatedUser,
    @Body() provisionOnboardingDto: ProvisionOnboardingDto,
  ) {
    return this.onboardingService.provision(user.id, provisionOnboardingDto);
  }
}
