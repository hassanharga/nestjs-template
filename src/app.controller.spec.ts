import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('getItem', () => {
    it('returns ok Result when id exists', () => {
      const result = appController.getItem(1);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({ id: 1, name: 'Example Item' });
    });

    it('returns err Result when id does not exist', () => {
      const result = appController.getItem(99);
      expect(result.isErr()).toBe(true);
    });
  });
});
