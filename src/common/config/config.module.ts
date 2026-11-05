import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configurationOptions } from './config.options';

@Module({ imports: [ConfigModule.forRoot(configurationOptions())] })
export class AppConfigModule {}
