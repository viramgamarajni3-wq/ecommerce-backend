import fs from "fs"
import path from "path"
import { db, testConnection } from "./src/db"
import { logger } from "./src/utils/logger"

async function runMigration() {
  try {
    await testConnection()
    
    // 1. Run Hardware Migration (if not already run)
    const hardwareFile = path.resolve(__dirname, "./database/hardware_migration.sql")
    if (fs.existsSync(hardwareFile)) {
      logger.info(`🔄 Running hardware migration from ${hardwareFile}`)
      const hardwareSql = fs.readFileSync(hardwareFile, "utf8")
      // Run it in chunks or ignore if columns already exist
      // Since it's a raw script, let's try to run it. If it fails, we'll log it.
      try {
        await db.query(hardwareSql)
        logger.info("✅ Hardware migration completed")
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          logger.warn(`⚠️ Hardware migration skipped or partially completed: ${err.message}`)
        } else {
          throw err
        }
      }
    }

    // 2. Run Services & Categories Migration
    const serviceFile = path.resolve(__dirname, "./database/service_and_categories_migration.sql")
    if (fs.existsSync(serviceFile)) {
      logger.info(`🔄 Running services & categories migration from ${serviceFile}`)
      const serviceSql = fs.readFileSync(serviceFile, "utf8")
      await db.query(serviceSql)
      logger.info("✅ Services & categories migration completed")
    }

    logger.info("🚀 All migrations completed successfully")
    process.exit(0)
  } catch (err) {
    logger.error("❌ Migration failed:", err)
    process.exit(1)
  }
}

runMigration()
