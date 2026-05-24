import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Create a PostgreSQL connection pool
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Create a new PrismaClient instance with the pg adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Clearing database...");
  await prisma.idempotencyKey.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log("Seeding warehouses...");
  const warehouses = [
    await prisma.warehouse.create({
      data: { name: "East Coast Fulfillment", location: "New York, NY" },
    }),
    await prisma.warehouse.create({
      data: { name: "West Coast Distribution", location: "Los Angeles, CA" },
    }),
    await prisma.warehouse.create({
      data: { name: "Midwest Logistics Hub", location: "Chicago, IL" },
    }),
  ];

  console.log("Seeding products...");
  const products = [
    await prisma.product.create({
      data: { name: "Ultralight Gaming Mouse", sku: "MS-UL-01" },
    }),
    await prisma.product.create({
      data: { name: "Mechanical Keyboard TKL", sku: "KB-MK-02" },
    }),
    await prisma.product.create({
      data: { name: '4K IPS Monitor 27"', sku: "MN-4K-03" },
    }),
    await prisma.product.create({
      data: { name: "Ergonomic Office Chair", sku: "CH-ER-04" },
    }),
    await prisma.product.create({
      data: { name: "Noise Cancelling Headphones", sku: "HP-NC-05" },
    }),
    await prisma.product.create({
      data: { name: "Wireless Charger Stand", sku: "CH-WL-06" },
    }),
    await prisma.product.create({
      data: { name: "USB-C Multi-port Hub", sku: "HB-UC-07" },
    }),
  ];

  console.log("Seeding inventories...");
  // Let's seed 21 inventory rows (7 products * 3 warehouses)
  const stockConfigs = [
    // Product 1 (Ultralight Gaming Mouse) - Low stock scenarios
    { total: 1, reserved: 0 }, // WH 1: Concurrency hotspot (exactly 1 left)
    { total: 15, reserved: 2 }, // WH 2: Medium stock
    { total: 5, reserved: 0 }, // WH 3: Low stock

    // Product 2 (Mechanical Keyboard TKL) - Out of stock scenario
    { total: 0, reserved: 0 }, // WH 1: Out of stock
    { total: 12, reserved: 1 }, // WH 2
    { total: 8, reserved: 0 }, // WH 3

    // Product 3 (4K IPS Monitor 27")
    { total: 10, reserved: 0 },
    { total: 10, reserved: 0 },
    { total: 10, reserved: 0 },

    // Product 4 (Ergonomic Office Chair)
    { total: 2, reserved: 0 }, // WH 1: Low stock
    { total: 20, reserved: 5 }, // WH 2: High stock
    { total: 4, reserved: 1 }, // WH 3

    // Product 5 (Noise Cancelling Headphones)
    { total: 30, reserved: 10 },
    { total: 25, reserved: 5 },
    { total: 15, reserved: 0 },

    // Product 6 (Wireless Charger Stand)
    { total: 50, reserved: 0 },
    { total: 40, reserved: 0 },
    { total: 30, reserved: 0 },

    // Product 7 (USB-C Multi-port Hub)
    { total: 100, reserved: 20 },
    { total: 80, reserved: 10 },
    { total: 50, reserved: 5 },
  ];

  let configIndex = 0;
  for (const product of products) {
    for (const warehouse of warehouses) {
      const config = stockConfigs[configIndex++];
      await prisma.inventory.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          totalUnits: config.total,
          reservedUnits: config.reserved,
        },
      });
    }
  }

  console.log("Seeding finished successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
