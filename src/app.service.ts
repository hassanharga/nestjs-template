import { Injectable } from '@nestjs/common';
import { Result, ok, err } from 'neverthrow';
import { NotFoundError } from './common/errors';
import { Log } from './common/decorators/log.decorator';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  @Log()
  getItem(id: number): Result<{ id: number; name: string }, NotFoundError> {
    if (id !== 1) {
      return err(new NotFoundError(`Item ${id} not found`));
    }
    return ok({ id, name: 'Example Item' });
  }
}
