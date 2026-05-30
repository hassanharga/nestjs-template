import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { ItemDto, SetItemDto } from './app.dto';

@ApiTags('Items')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Hello world' })
  @ApiResponse({
    status: 200,
    description: 'Returns a greeting string',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('items')
  @ApiOperation({ summary: 'Create an item' })
  @ApiBody({ type: SetItemDto })
  @ApiResponse({ status: 201, type: ItemDto, description: 'Item created' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  setItem(@Body() body: SetItemDto) {
    return this.appService.setItem(body).match(
      (item) => item,
      (error) => {
        throw error;
      },
    );
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Item ID', example: 42 })
  @ApiResponse({ status: 200, type: ItemDto, description: 'Item found' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  getItem(@Param('id', ParseIntPipe) id: number) {
    return this.appService.getItem(id).match(
      (item) => item,
      (error) => {
        throw error;
      },
    );
  }
}
