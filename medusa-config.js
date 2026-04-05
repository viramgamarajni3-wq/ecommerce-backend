const path = require("path")
const dotenv = require("dotenv")

dotenv.config({ path: path.join(__dirname, ".env") })

module.exports = {
  projectConfig: {
    jwtSecret: process.env.JWT_SECRET || "supersecret",
    cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    store_cors: (process.env.STORE_CORS || "http://localhost:3000").split(","),
    admin_cors: ((process.env.ADMIN_CORS || "http://localhost:3001") + (process.env.VENDOR_CORS ? `,${process.env.VENDOR_CORS}` : "")).split(","),
    database_url: (process.env.DATABASE_URL || "postgres://postgres:root@localhost:5432/ecommerce_db").trim(),
    vendor_cors: (process.env.VENDOR_CORS || "http://localhost:3002").split(","),
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
  ],
  modules: {
    eventBus: {
      resolve: "@medusajs/event-bus-local",
    },
    cacheService: {
      resolve: "@medusajs/cache-inmemory",
    },
  },
}
