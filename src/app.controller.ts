import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { AppService } from './app.service';
import { ApiBody } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('items')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { id: { type: 'number' } },
      required: ['id'],
    },
  })
  setItem(@Body() body: { id: number }) {
    return this.appService.setItem(body.id).match(
      (item) => item,
      (error) => {
        throw error;
      },
    );
  }

  @Get('items/:id')
  getItem(@Param('id', ParseIntPipe) id: number) {
    return this.appService.getItem(id).match(
      (item) => item,
      (error) => {
        throw error;
      },
    );
  }
}
