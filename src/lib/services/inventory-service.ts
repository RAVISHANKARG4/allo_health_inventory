import { prisma } from "../prisma";

export class InventoryService {
  /**
   * Returns all products, their warehouse inventories, and calculated available units.
   */
  static async getProductsWithInventory() {
    if (!prisma) {
      throw new Error(
        "Prisma client is not initialized. Check DATABASE_URL environment variable.",
      );
    }

    const products = await prisma.product.findMany({
      include: {
        inventory: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      createdAt: product.createdAt,
      inventory: product.inventory.map((inv) => ({
        id: inv.id,
        productId: inv.productId,
        warehouseId: inv.warehouseId,
        totalUnits: inv.totalUnits,
        reservedUnits: inv.reservedUnits,
        availableUnits: Math.max(0, inv.totalUnits - inv.reservedUnits),
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        warehouse: {
          id: inv.warehouse.id,
          name: inv.warehouse.name,
          location: inv.warehouse.location,
        },
      })),
    }));
  }

  /**
   * Returns all warehouses.
   */
  static async getWarehouses() {
    if (!prisma) {
      throw new Error(
        "Prisma client is not initialized. Check DATABASE_URL environment variable.",
      );
    }

    return prisma.warehouse.findMany({
      orderBy: {
        name: "asc",
      },
    });
  }
}
