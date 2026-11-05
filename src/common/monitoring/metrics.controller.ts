import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { RawResponse } from '../interceptors/raw-response.decorator';
import { MetricsRegistry } from './metrics.registry';

@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
@SkipThrottle()
@RawResponse()
export class MetricsController {
  constructor(private readonly registry: MetricsRegistry) {}

  @Get()
  metrics(@Res({ passthrough: true }) response: Response): Promise<string> {
    response.type(this.registry.contentType);
    return this.registry.metrics();
  }
}
