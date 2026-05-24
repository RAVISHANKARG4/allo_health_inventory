import { NextResponse } from 'next/server';
import { InventoryService } from '@/lib/services/inventory-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await InventoryService.getProductsWithInventory();
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        error: {
          code: 'SERVER_ERROR',
          message: 'An unexpected error occurred while fetching products.',
        },
      },
      { status: 500 }
    );
  }
}
