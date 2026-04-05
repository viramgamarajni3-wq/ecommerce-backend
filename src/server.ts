import "./load-env" // trigger reload
import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { json } from "body-parser"
import { authRouter } from "./routes/auth"
import { productsRouter } from "./routes/products"
import { cartRouter } from "./routes/cart"
import { ordersRouter } from "./routes/orders"
import { vendorsRouter } from "./routes/vendors"
import { reviewsRouter } from "./routes/reviews"
import { uploadsRouter } from "./routes/uploads"
import { paymentRouter } from "./routes/payment"
import { adminRouter } from "./routes/admin"
import { storeRouter } from "./routes/store"
import { inquiriesRouter } from "./routes/inquiries"
import { servicesRouter } from "./routes/services"
import { categoriesRouter } from "./routes/categories"
import { collectionsRouter } from "./routes/collections"
import { errorHandler } from "./middleware/errorHandler"
import { logger } from "./utils/logger"

const app = express()
const PORT = process.env.PORT || 9000

// Required for express-rate-limit behind Railway/Cloudflare/Heroku proxy
app.set("trust proxy", 1)

// ─── Security Middleware ─────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}))

app.use(cors({
  origin: (origin, callback) => {
    // Collect all allowed origins from environment variables
    const allowedOrigins = [
      ...(process.env.STORE_CORS || "").split(","),
      ...(process.env.ADMIN_CORS || "").split(","),
      ...(process.env.VENDOR_CORS || "").split(","),
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ].filter(Boolean).map(o => o.trim().toLowerCase())

    if (!origin || allowedOrigins.some(ao => origin.toLowerCase().includes(ao) || ao.includes(origin.toLowerCase()))) {
      callback(null, true)
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`)
      callback(new Error('Not allowed by CORS'), false)
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "idempotency-key", 
    "x-medusa-access-token", 
    "x-medusa-publishable-key",
    "x-medusa-id",
    "x-publishable-api-key",
    "x-cart-id",
    "x-region-id"
  ],
}))

// ─── Rate Limiting ──────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: "Too many requests, please try again later." },
  validate: { xForwardedForHeader: false },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many auth attempts, please try again later." },
  validate: { xForwardedForHeader: false },
})

app.use(globalLimiter)
app.use(json({ limit: "10mb" }))

// ─── Health Check ────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// ─── API Routes ──────────────────────────────────────────────
const API_PREFIX = "/api/v1"

app.use(`${API_PREFIX}/auth`, authLimiter, authRouter)
app.use(`${API_PREFIX}/products`, productsRouter)
app.use(`${API_PREFIX}/inquiries`, inquiriesRouter)
app.use(`${API_PREFIX}/cart`, cartRouter)
app.use(`${API_PREFIX}/orders`, ordersRouter)
app.use(`${API_PREFIX}/vendors`, vendorsRouter)
app.use(`${API_PREFIX}/reviews`, reviewsRouter)
app.use(`${API_PREFIX}/uploads`, uploadsRouter)
app.use(`${API_PREFIX}/payment`, paymentRouter)
app.use(`${API_PREFIX}/admin`, adminRouter)
app.use(`${API_PREFIX}/categories`, categoriesRouter)
app.use(`${API_PREFIX}/services`, servicesRouter)
app.use(`${API_PREFIX}/collections`, collectionsRouter)
app.use(`/store`, storeRouter)

// ─── Razorpay Webhook (raw body needed) ─────────────────────
app.use(`${API_PREFIX}/webhooks/razorpay`, express.raw({ type: "application/json" }))

// ─── Error Handler ───────────────────────────────────────────
app.use(errorHandler)

// ─── Start Server (Only if not in Netlify Functions) ──────────
if (process.env.NODE_ENV !== "test" && !process.env.NETLIFY && !process.env.FUNCTIONS_EMULATOR) {
  app.listen(PORT, () => {
    logger.info(`🚀 Ecommerce API running on http://localhost:${PORT}`)
    logger.info(`📚 API Prefix: ${API_PREFIX}`)
    logger.info(`🌍 Environment: ${process.env.NODE_ENV}`)
  })
}

export default app
