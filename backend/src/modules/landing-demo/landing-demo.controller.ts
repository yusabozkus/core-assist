import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LandingDemoQuestionDto } from './dto/landing-demo-question.dto';
import { LandingDemoService } from './landing-demo.service';

@Controller('landing-demo')
export class LandingDemoController {
  constructor(private readonly demo: LandingDemoService) {}

  @Get('products')
  products() {
    return this.demo.products();
  }

  @Get('usage')
  usage(@Req() request: Request) {
    return this.demo.usage(request.ip || request.socket.remoteAddress || '');
  }

  @Post('answer')
  @HttpCode(200)
  answer(@Body() body: LandingDemoQuestionDto, @Req() request: Request) {
    return this.demo.answer(
      body,
      request.ip || request.socket.remoteAddress || '',
    );
  }
}
