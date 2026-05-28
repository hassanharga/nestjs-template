import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('items/:id')
  getItem(@Param('id', ParseIntPipe) id: number) {
    return this.appService.getItem(id).match(
      (item) => item,
      (error) => error.throw(),
    );
  }
}
