import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { OnboardingService } from './onboarding.service';

type AuthenticatedUser = {
  id: string;
};

@Controller('onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getStatus(user.id);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() completeOnboardingDto: CompleteOnboardingDto,
  ) {
    return this.onboardingService.complete(user.id, completeOnboardingDto);
  }
}
