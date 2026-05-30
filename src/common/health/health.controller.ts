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
    const rssBytes =
      this.config.get('HEALTH_RSS_MEMORY_MB', { infer: true })! * 1024 * 1024;

    const diskThreshold = this.config.get('HEALTH_DISK_THRESHOLD_PERCENT', {
      infer: true,
    })!;

    return this.health.check([
      () => this.memory.checkHeap('memory_heap', heapBytes),
      () => this.memory.checkHeap('memory_rss', rssBytes),
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: diskThreshold,
        }),
      // async () => {
      //   try {
      //     const conn = getConnection();
      //     if (conn.readyState === 1) {
      //       return {
      //         mongodb: {
      //           status: 'up',
      //         },
      //       };
      //     }
      //     return {
      //       mongodb: {
      //         status: 'down',
      //         message: 'MongoDB connection not ready',
      //       },
      //     };
      //   } catch (error) {
      //     return {
      //       mongodb: {
      //         status: 'down',
      //         message: error instanceof Error ? error.message : 'Unknown error',
      //       },
      //     };
      //   }
      // },
      // async () => {
      //   try {
      //     await this.redis.get('health-check');
      //     return {
      //       redis: {
      //         status: 'up',
      //       },
      //     };
      //   } catch (error) {
      //     return {
      //       redis: {
      //         status: 'down',
      //         message: error instanceof Error ? error.message : 'Unknown error',
      //       },
      //     };
      //   }
      // },
    ]);
  }
}
