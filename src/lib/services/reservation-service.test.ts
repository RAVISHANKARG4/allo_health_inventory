import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma';
import { ReservationService } from './reservation-service';

describe('Reservation Service Integration Tests', () => {
  beforeAll(async () => {
    try {
      await prisma.$connect();
    } catch (err) {
      console.error('Database connection failed. Ensure your DATABASE_URL is correct.');
      throw err;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should handle concurrent reservations for the last unit safely', async () => {
    // 1. Setup product, warehouse and inventory with exactly 1 unit available
    const product = await prisma.product.create({
      data: { name: 'Concurrency Test Mouse', sku: 'TEST-SKU-CONC' },
    });
    const warehouse = await prisma.warehouse.create({
      data: { name: 'Test Warehouse', location: 'Test Location' },
    });
    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        totalUnits: 1,
        reservedUnits: 0,
      },
    });

    // 2. Fire two reservation requests in parallel
    const results = await Promise.allSettled([
      ReservationService.createReservation(product.id, warehouse.id, 1),
      ReservationService.createReservation(product.id, warehouse.id, 1),
    ]);

    // 3. Exactly one should succeed and one should fail
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Verify rejected error code
    const rejectReason = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectReason.message).toBe('INSUFFICIENT_STOCK');

    // Verify reservedUnits is 1 in DB
    const updatedInv = await prisma.inventory.findUnique({
      where: { id: inventory.id },
    });
    expect(updatedInv?.reservedUnits).toBe(1);

    // Clean up
    const reservations = await prisma.reservation.findMany({
      where: { productId: product.id, warehouseId: warehouse.id },
    });
    for (const res of reservations) {
      await prisma.reservation.delete({ where: { id: res.id } });
    }
    await prisma.inventory.delete({ where: { id: inventory.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
  });

  it('should confirm a reservation and reduce total and reserved stock', async () => {
    // 1. Setup product, warehouse and inventory
    const product = await prisma.product.create({
      data: { name: 'Confirm Test Keyboard', sku: 'TEST-SKU-CONF' },
    });
    const warehouse = await prisma.warehouse.create({
      data: { name: 'Test Warehouse Conf', location: 'Test Location' },
    });
    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        totalUnits: 10,
        reservedUnits: 0,
      },
    });

    // Create reservation
    const reservation = await ReservationService.createReservation(product.id, warehouse.id, 2);

    // Verify stock is reserved
    let currentInv = await prisma.inventory.findUnique({ where: { id: inventory.id } });
    expect(currentInv?.reservedUnits).toBe(2);
    expect(currentInv?.totalUnits).toBe(10);

    // Confirm reservation
    const confirmed = await ReservationService.confirmReservation(reservation.id);
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.confirmedAt).not.toBeNull();

    // Verify total units and reserved units decreased
    currentInv = await prisma.inventory.findUnique({ where: { id: inventory.id } });
    expect(currentInv?.totalUnits).toBe(8);
    expect(currentInv?.reservedUnits).toBe(0);

    // Clean up
    await prisma.reservation.delete({ where: { id: reservation.id } });
    await prisma.inventory.delete({ where: { id: inventory.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
  });

  it('should release expired pending reservations via the cleanup function', async () => {
    // 1. Setup product, warehouse and inventory
    const product = await prisma.product.create({
      data: { name: 'Expiry Test Chair', sku: 'TEST-SKU-EXP' },
    });
    const warehouse = await prisma.warehouse.create({
      data: { name: 'Test Warehouse Exp', location: 'Test Location' },
    });
    const inventory = await prisma.inventory.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        totalUnits: 5,
        reservedUnits: 2, // 2 units pre-reserved
      },
    });

    // Create a manual expired reservation
    const expiredRes = await prisma.reservation.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: 2,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 5000), // expired 5s ago
      },
    });

    // Run expiration cleanup
    const releasedIds = await ReservationService.releaseExpiredReservations();
    expect(releasedIds).toContain(expiredRes.id);

    // Verify reservation status in DB is RELEASED
    const updatedRes = await prisma.reservation.findUnique({ where: { id: expiredRes.id } });
    expect(updatedRes?.status).toBe('RELEASED');
    expect(updatedRes?.releasedAt).not.toBeNull();

    // Verify inventory reservedUnits decremented back to 0
    const updatedInv = await prisma.inventory.findUnique({ where: { id: inventory.id } });
    expect(updatedInv?.reservedUnits).toBe(0);

    // Clean up
    await prisma.reservation.delete({ where: { id: expiredRes.id } });
    await prisma.inventory.delete({ where: { id: inventory.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.delete({ where: { id: warehouse.id } });
  });
});
