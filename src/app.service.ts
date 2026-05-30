import { Injectable, NotFoundException } from '@nestjs/common';
import { Result, ok, err } from 'neverthrow';
import { Log } from './common/decorators/log.decorator';

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
  setItem(id: number): Result<{ id: number; name: string }, NotFoundException> {
    if (!id) {
      return err(new NotFoundException(`invalid id`));
    }
    return ok({ id, name: `Example Item ${id}` });
  }
}
