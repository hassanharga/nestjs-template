import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SetItemSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe('Unique item identifier')
    .meta({ example: 42 }),
  name: z
    .string()
    .min(1)
    .max(100)
    .describe('Item display name')
    .meta({ example: 'My Item' }),
});

export class SetItemDto extends createZodDto(SetItemSchema) {}

const ItemSchema = z.object({
  id: z.number().int().positive().meta({ example: 42 }),
  name: z.string().meta({ example: 'My Item' }),
});

export class ItemDto extends createZodDto(ItemSchema) {}
