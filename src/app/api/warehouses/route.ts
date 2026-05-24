import { NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const warehouses = await InventoryService.getWarehouses();
    return NextResponse.json(warehouses);
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred while fetching warehouses.',
        },
      },
      { status: 500 }
    );
  }
}
