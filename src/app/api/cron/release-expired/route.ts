import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/lib/services/reservation-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Unauthorized cron trigger.',
          },
        },
        { status: 401 }
      );
    }
  }

  try {
    const releasedIds = await ReservationService.releaseExpiredReservations();
    return NextResponse.json({
      success: true,
      releasedCount: releasedIds.length,
      releasedIds,
    });
  } catch (error) {
    console.error('Error executing release-expired cron:', error);
    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred while releasing expired reservations.',
        },
      },
      { status: 500 }
    );
  }
}
