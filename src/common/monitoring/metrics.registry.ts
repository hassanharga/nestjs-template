import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { collectDefaultMetrics, Registry } from 'prom-client';

/** A separate registry for each Nest application, including default collectors. */
@Injectable()
export class MetricsRegistry extends Registry implements OnModuleDestroy {
  constructor() {
    super();
    collectDefaultMetrics({ register: this });
  }

  onModuleDestroy(): void {
    this.clear();
  }
}
