import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/lib/services/reservation-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await ReservationService.getReservationById(id);

    if (!reservation) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Reservation not found',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      },
      { status: 500 }
    );
  }
}
