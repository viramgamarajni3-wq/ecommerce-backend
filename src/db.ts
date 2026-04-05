import { Pool } from "pg"
import dotenv from "dotenv"
import path from "path"
import { logger } from "./utils/logger"

// Re-check/load environment variables if not already loaded
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  logger.warn("⚠️ DATABASE_URL is not defined in environment variables. Falling back to default connection.")
}

export const db = new Pool({
  connectionString: DATABASE_URL || "postgres://postgres:root@localhost:5432/ecommerce_db",
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

db.on("connect", () => logger.info("📦 New DB connection established"))
db.on("error", (err) => logger.error("❌ DB connection error:", err))

export async function testConnection() {
  try {
    const client = await db.connect()
    await client.query("SELECT NOW()")
    client.release()
    logger.info("✅ Database connected successfully")
  } catch (err) {
    logger.error("❌ Failed to connect to the database:", err)
    process.exit(1)
  }
}
