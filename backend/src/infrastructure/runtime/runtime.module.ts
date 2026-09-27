import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RuntimeState } from './runtime-state';
import { ReadinessService } from './readiness.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [RuntimeState, ReadinessService],
  exports: [RuntimeState, ReadinessService, DiscoveryModule],
})
export class RuntimeModule {}
