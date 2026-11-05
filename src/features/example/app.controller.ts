import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import {
  ApiEnvelope,
  ApiErrorEnvelope,
} from '../../common/interceptors/envelope.swagger';
import { ItemDto, SetItemDto } from './app.dto';

@ApiTags('Items')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Hello world' })
  @ApiEnvelope(200, { type: 'string', example: 'Hello World!' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('items')
  @ApiOperation({ summary: 'Create an item' })
  @ApiBody({ type: SetItemDto })
  @ApiEnvelope(201, ItemDto)
  @ApiErrorEnvelope(400)
  setItem(@Body() body: SetItemDto) {
    return this.appService.setItem(body);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Item ID', example: 42 })
  @ApiEnvelope(200, ItemDto)
  @ApiErrorEnvelope(400)
  @ApiErrorEnvelope(404)
  getItem(@Param('id', ParseIntPipe) id: number) {
    return this.appService.getItem(id);
  }
}
