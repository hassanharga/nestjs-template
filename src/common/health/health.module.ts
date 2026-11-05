import { Global, Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

import { DrainState } from './drain-state';

@Global()
@Module({
  providers: [DrainState],
  exports: [DrainState],
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
