import {
  Controller,
  Get,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { DrainState } from './drain-state';
import { AppConfig } from '../config/config.schema';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly config: ConfigService<AppConfig>,
    private readonly drain: DrainState = new DrainState(),
  ) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    if (this.drain.draining)
      throw new ServiceUnavailableException('Service draining');
    const heapBytes =
      this.config.get('HEALTH_MEMORY_HEAP_MB', { infer: true })! * 1024 * 1024;
    const rssBytes =
      this.config.get('HEALTH_RSS_MEMORY_MB', { infer: true })! * 1024 * 1024;

    const diskThreshold = this.config.get('HEALTH_DISK_THRESHOLD_PERCENT', {
      infer: true,
    })!;

    return this.health.check([
      () => this.memory.checkHeap('memory_heap', heapBytes),
      () => this.memory.checkRSS('memory_rss', rssBytes),
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: diskThreshold,
        }),
    ]);
  }
}
