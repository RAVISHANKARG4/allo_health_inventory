import { z } from 'zod';

export const createReservationSchema = z.object({
  productId: z.string().uuid('Invalid Product ID format'),
  warehouseId: z.string().uuid('Invalid Warehouse ID format'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0'),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
