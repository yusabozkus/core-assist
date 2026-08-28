import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';
import { CurrentUser } from './auth/current-user.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Veritabanı ve Prisma durum kontrolü
  @Get('health')
  async getHealth() {
    const userCount = await this.prisma.user.count();
    return {
      status: 'ok',
      database: 'connected',
      userCount,
      timestamp: new Date().toISOString(),
    };
  }

  // Better Auth ile korunan test endpoint'i
  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@CurrentUser() user: any) {
    return {
      message: 'Giriş başarılı!',
      user,
    };
  }
}
