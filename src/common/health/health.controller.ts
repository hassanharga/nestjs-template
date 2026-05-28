import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/config.schema';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    const heapBytes =
      this.config.get('HEALTH_MEMORY_HEAP_MB', { infer: true })! * 1024 * 1024;

    const diskThreshold = this.config.get('HEALTH_DISK_THRESHOLD_PERCENT', {
      infer: true,
    })!;

    return this.health.check([
      () => this.memory.checkHeap('memory_heap', heapBytes),
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: diskThreshold,
        }),
    ]);
  }
}
