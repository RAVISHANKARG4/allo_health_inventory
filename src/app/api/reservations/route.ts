import { NextRequest, NextResponse } from 'next/server';
import { createReservationSchema } from '@/lib/schemas/reservation';
import { ReservationService } from '@/lib/services/reservation-service';
import { IdempotencyService } from '@/lib/services/idempotency-service';

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');

  // Check idempotency cache
  if (idempotencyKey) {
    try {
      const cached = await IdempotencyService.get(idempotencyKey, 'createReservation');
      if (cached) {
        return NextResponse.json(cached.responseBody, { status: cached.statusCode });
      }
    } catch (err) {
      console.error('Error fetching idempotency cache:', err);
    }
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid JSON body.',
          },
        },
        { status: 400 }
      );
    }

    const result = createReservationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed.',
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = result.data;

    const reservation = await ReservationService.createReservation(
      productId,
      warehouseId,
      quantity
    );

    const successResponse = { reservation };

    if (idempotencyKey) {
      await IdempotencyService.store(idempotencyKey, 'createReservation', 201, successResponse);
    }

    return NextResponse.json(successResponse, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/reservations:', error);

    let status = 500;
    let code = 'SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    const errorMessage = error instanceof Error ? error.message : undefined;

    if (errorMessage === 'INSUFFICIENT_STOCK') {
      status = 409;
      code = 'INSUFFICIENT_STOCK';
      message = 'Insufficient stock available to complete this reservation.';
    } else if (errorMessage === 'INVENTORY_NOT_FOUND') {
      status = 404;
      code = 'INVENTORY_NOT_FOUND';
      message = 'The requested product-warehouse inventory record was not found.';
    }

    const errorResponse = {
      error: {
        code,
        message,
      },
    };

    if (idempotencyKey) {
      await IdempotencyService.store(idempotencyKey, 'createReservation', status, errorResponse);
    }

    return NextResponse.json(errorResponse, { status });
  }
}
