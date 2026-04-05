import { defineConfig } from "@medusajs/medusa"
import path from "path"

module.exports = defineConfig({
  projectConfig: {
    jwtSecret: process.env.JWT_SECRET || "supersecret",
    cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    store_cors: process.env.STORE_CORS || "http://localhost:3000",
    admin_cors: process.env.ADMIN_CORS || "http://localhost:3001",
    database_url: process.env.DATABASE_URL || "postgres://postgres:root@localhost:5432/ecommerce",
    redis_url: process.env.REDIS_URL || "redis://localhost:6379",
    database_extra: {},
  },
  plugins: [
    {
      resolve: "medusa-fulfillment-manual",
      options: {},
    },
    {
      resolve: "medusa-payment-manual",
      options: {},
    },
    {
      resolve: "medusa-file-cloudinary",
      options: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      },
    },
  ],
  modules: {
    vendorModuleService: {
      resolve: "./src/modules/vendor",
    },
    payoutModuleService: {
      resolve: "./src/modules/payout",
    },
  },
})
