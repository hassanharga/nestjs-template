import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
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
    it('returns the item when id exists', () => {
      expect(appController.getItem(1)).toEqual({ id: 1, name: 'Example Item' });
    });

    it('throws HttpException with 404 when id does not exist', () => {
      expect(() => appController.getItem(99)).toThrow(HttpException);
    });
  });
});
