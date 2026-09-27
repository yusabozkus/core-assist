import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { ReadinessService } from './infrastructure/runtime/readiness.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly readiness: ReadinessService,
  ) {}

  @Get('health/ready')
  @Header('Cache-Control', 'no-store')
  async getReadiness() {
    if (!(await this.readiness.check()))
      throw new ServiceUnavailableException('Not ready');
    return { status: 'ready' };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
