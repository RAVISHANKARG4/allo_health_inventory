import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/lib/services/reservation-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const reservation = await ReservationService.releaseReservation(id);
    return NextResponse.json({ reservation }, { status: 200 });
  } catch (error: any) {
    console.error(`Error releasing reservation ${id}:`, error);

    let status = 500;
    let code = 'SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (error.message === 'RESERVATION_NOT_FOUND') {
      status = 404;
      code = 'RESERVATION_NOT_FOUND';
      message = 'The specified reservation was not found.';
    } else if (error.message === 'RESERVATION_ALREADY_CONFIRMED') {
      status = 400;
      code = 'RESERVATION_ALREADY_CONFIRMED';
      message = 'This reservation has already been confirmed and cannot be released.';
    }

    return NextResponse.json(
      {
        error: {
          code,
          message,
        },
      },
      { status }
    );
  }
}
