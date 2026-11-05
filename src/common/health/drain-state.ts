import { Injectable } from '@nestjs/common';

@Injectable()
export class DrainState {
  draining = false;
}
