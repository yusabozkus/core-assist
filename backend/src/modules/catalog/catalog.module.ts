import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
