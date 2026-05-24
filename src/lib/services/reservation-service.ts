import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

export class ReservationService {
  /**
   * Safe reservation creation under concurrency using row-level locking.
   */
  static async createReservation(
    productId: string,
    warehouseId: string,
    quantity: number,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock the inventory row using SELECT FOR UPDATE
      const inventories = await tx.$queryRaw<Prisma.InventoryGetPayload<{}>[]>`
        SELECT * FROM "Inventory"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const inventory = inventories[0];
      const available = inventory.totalUnits - inventory.reservedUnits;

      // 2. Compute available stock and check if sufficient
      if (available < quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      // 3. Increment reservedUnits in Inventory
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET "reservedUnits" = "reservedUnits" + ${quantity}, "updatedAt" = NOW()
        WHERE "id" = ${inventory.id}
      `;

      // 4. Create the PENDING reservation
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
        },
      });

      return reservation;
    });
  }

  /**
   * Confirms a reservation, converting temporary reserved units to permanently consumed units.
   */
  static async confirmReservation(reservationId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Find the reservation
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      // 2. Idempotency checks
      if (reservation.status === "CONFIRMED") {
        return reservation;
      }
      if (reservation.status === "RELEASED") {
        throw new Error("RESERVATION_RELEASED");
      }
      if (reservation.expiresAt < new Date()) {
        throw new Error("RESERVATION_EXPIRED");
      }

      // 3. Lock corresponding inventory row
      const inventories = await tx.$queryRaw<Prisma.InventoryGetPayload<{}>[]>`
        SELECT * FROM "Inventory"
        WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId}
        FOR UPDATE
      `;

      if (inventories.length === 0) {
        throw new Error("INVENTORY_NOT_FOUND");
      }

      const inventory = inventories[0];

      // 4. Decrement totalUnits and reservedUnits in Inventory
      await tx.$executeRaw`
        UPDATE "Inventory"
        SET "totalUnits" = "totalUnits" - ${reservation.quantity},
            "reservedUnits" = "reservedUnits" - ${reservation.quantity},
            "updatedAt" = NOW()
        WHERE "id" = ${inventory.id}
      `;

      // 5. Update Reservation status to CONFIRMED
      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      return updatedReservation;
    });
  }

  /**
   * Releases a reservation, returning reserved stock to availability.
   * Must be idempotent.
   */
  static async releaseReservation(reservationId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Find the reservation
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new Error("RESERVATION_NOT_FOUND");
      }

      // 2. Idempotency checks
      if (reservation.status === "RELEASED") {
        return reservation;
      }
      if (reservation.status === "CONFIRMED") {
        throw new Error("RESERVATION_ALREADY_CONFIRMED");
      }

      // 3. Lock corresponding inventory row
      const inventories = await tx.$queryRaw<Prisma.InventoryGetPayload<{}>[]>`
        SELECT * FROM "Inventory"
        WHERE "productId" = ${reservation.productId} AND "warehouseId" = ${reservation.warehouseId}
        FOR UPDATE
      `;

      if (inventories.length > 0) {
        const inventory = inventories[0];
        // Decrement reservedUnits, ensuring it doesn't go below 0
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET "reservedUnits" = GREATEST(0, "reservedUnits" - ${reservation.quantity}),
              "updatedAt" = NOW()
          WHERE "id" = ${inventory.id}
        `;
      }

      // 4. Update status to RELEASED
      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });

      return updatedReservation;
    });
  }

  /**
   * Releases expired PENDING reservations.
   * Triggered by cron endpoint, processes each reservation in an independent transaction.
   */
  static async releaseExpiredReservations() {
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    const releasedIds: string[] = [];

    for (const res of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Re-fetch to ensure status hasn't changed
          const currentRes = await tx.reservation.findUnique({
            where: { id: res.id },
          });

          if (!currentRes || currentRes.status !== "PENDING") {
            return;
          }

          // Lock inventory row
          const inventories = await tx.$queryRaw<
            Prisma.InventoryGetPayload<{}>[]
          >`
            SELECT * FROM "Inventory"
            WHERE "productId" = ${res.productId} AND "warehouseId" = ${res.warehouseId}
            FOR UPDATE
          `;

          if (inventories.length > 0) {
            const inventory = inventories[0];
            await tx.$executeRaw`
              UPDATE "Inventory"
              SET "reservedUnits" = GREATEST(0, "reservedUnits" - ${res.quantity}),
                  "updatedAt" = NOW()
              WHERE "id" = ${inventory.id}
            `;
          }

          // Update reservation
          await tx.reservation.update({
            where: { id: res.id },
            data: {
              status: "RELEASED",
              releasedAt: new Date(),
            },
          });

          releasedIds.push(res.id);
        });
      } catch (err) {
        console.error(`Error releasing expired reservation ${res.id}:`, err);
      }
    }

    return releasedIds;
  }

  /**
   * Retrieves reservation by ID along with product and warehouse info.
   */
  static async getReservationById(id: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return null;
    }

    const product = await prisma.product.findUnique({
      where: { id: reservation.productId },
    });

    const warehouse = await prisma.warehouse.findUnique({
      where: { id: reservation.warehouseId },
    });

    return {
      ...reservation,
      product,
      warehouse,
    };
  }
}