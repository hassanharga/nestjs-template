import { Injectable, NotFoundException } from '@nestjs/common';
import { Result, ok, err } from 'neverthrow';
import { Log } from './common/decorators/log.decorator';
import { SetItemDto } from './app.dto';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  @Log()
  getItem(id: number): Result<{ id: number; name: string }, NotFoundException> {
    if (id !== 1) {
      return err(new NotFoundException(`Item ${id} not found`));
    }
    return ok({ id, name: 'Example Item' });
  }

  @Log()
  setItem(
    dto: SetItemDto,
  ): Result<{ id: number; name: string }, NotFoundException> {
    return ok({ id: dto.id, name: dto.name });
  }
}
