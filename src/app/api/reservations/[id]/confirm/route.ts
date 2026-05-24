import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/lib/services/reservation-service';
import { IdempotencyService } from '@/lib/services/idempotency-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');

  // Check idempotency cache
  if (idempotencyKey) {
    try {
      const cached = await IdempotencyService.get(idempotencyKey, `confirmReservation:${id}`);
      if (cached) {
        return NextResponse.json(cached.responseBody, { status: cached.statusCode });
      }
    } catch (err) {
      console.error('Error fetching idempotency cache:', err);
    }
  }

  try {
    const reservation = await ReservationService.confirmReservation(id);
    const successResponse = { reservation };

    if (idempotencyKey) {
      await IdempotencyService.store(
        idempotencyKey,
        `confirmReservation:${id}`,
        200,
        successResponse
      );
    }

    return NextResponse.json(successResponse, { status: 200 });
  } catch (error: unknown) {
    console.error(`Error confirming reservation ${id}:`, error);

    let status = 500;
    let code = 'SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (error instanceof Error && error.message === 'RESERVATION_EXPIRED') {
      status = 410;
      code = 'RESERVATION_EXPIRED';
      message = 'This reservation has expired and cannot be confirmed.';
    } else if (error instanceof Error && error.message === 'RESERVATION_RELEASED') {
      status = 400;
      code = 'RESERVATION_RELEASED';
      message = 'This reservation was already cancelled or released.';
    } else if (error instanceof Error && error.message === 'RESERVATION_NOT_FOUND') {
      status = 404;
      code = 'RESERVATION_NOT_FOUND';
      message = 'The specified reservation was not found.';
    } else if (error instanceof Error && error.message === 'INVENTORY_NOT_FOUND') {
      status = 404;
      code = 'INVENTORY_NOT_FOUND';
      message = 'The corresponding inventory record was not found.';
    }

    const errorResponse = {
      error: {
        code,
        message,
      },
    };

    if (idempotencyKey) {
      await IdempotencyService.store(
        idempotencyKey,
        `confirmReservation:${id}`,
        status,
        errorResponse
      );
    }

    return NextResponse.json(errorResponse, { status });
  }
}
