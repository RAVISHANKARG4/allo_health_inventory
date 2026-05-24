import "dotenv/config";
import process from "process";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error("❌ Error: REDIS_URL environment variable is not set.");
  console.error("Please ensure your .env file contains a valid REDIS_URL.");
  process.exit(1);
}

try {
  const redis = new Redis({
    url: redisUrl,
  });

  await redis.ping();
  console.log("✓ Redis connection successful");
} catch (error) {
  console.error("❌ Error: Unable to connect to Redis");
  console.error(`Details: ${error.message}`);
  process.exit(1);
}
