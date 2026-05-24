import "dotenv/config";
import process from "process";

const databaseUrlDirect =
  process.env.DATABASE_URL_DIRECT || process.env.DIRECT_URL;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrlDirect && !databaseUrl) {
  console.error(
    "❌ Error: DATABASE_URL, DATABASE_URL_DIRECT, or DIRECT_URL environment variable is not set.",
  );
  console.error(
    "Please ensure your .env file contains DATABASE_URL and DIRECT_URL for migrations.",
  );
  process.exit(1);
}

if (databaseUrlDirect) {
  console.log("✓ Direct database URL is configured");
} else {
  console.log("✓ DATABASE_URL is configured");
}
