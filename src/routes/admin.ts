import { Router } from "express"
import { db } from "../db"
import { authenticate, authorize } from "../middleware/auth"

// Import modular routers
import { adminProductRouter } from "./admin/products"
import { adminCustomerRouter } from "./admin/customers"
import { adminDiscountRouter } from "./admin/discounts"
import { adminInventoryRouter } from "./admin/inventory"
import { adminOrderRouter } from "./admin/orders"

export const adminRouter = Router()

// Common middleware for all admin routes
adminRouter.use(authenticate, authorize("admin"))

// ─── Modular Routes (Scalable Architecture) ─────────────────
adminRouter.use("/products", adminProductRouter)
adminRouter.use("/customers", adminCustomerRouter)
adminRouter.use("/discounts", adminDiscountRouter)
adminRouter.use("/inventory", adminInventoryRouter)
adminRouter.use("/orders", adminOrderRouter)

// ─── Analytics & Reports ────────────────────────────────────
adminRouter.get("/analytics", async (req, res, next) => {
  try {
    const [userCount, vendorCount, productCount, orderStats, revenue] = await Promise.all([
      db.query("SELECT COUNT(*) FROM users WHERE role='customer'"),
      db.query("SELECT COUNT(*), status FROM vendors GROUP BY status"),
      db.query("SELECT COUNT(*), status FROM products GROUP BY status"),
      db.query(
        `SELECT
          COUNT(*) as total_orders,
          COUNT(*) FILTER(WHERE status='delivered') as delivered,
          COUNT(*) FILTER(WHERE status='pending') as pending,
          COUNT(*) FILTER(WHERE created_at >= NOW()-INTERVAL '30 days') as this_month
         FROM orders`
      ),
      db.query(
        `SELECT
          SUM(total) as total_revenue,
          SUM(CASE WHEN created_at >= NOW()-INTERVAL '30 days' THEN total ELSE 0 END) as monthly_revenue,
          SUM(CASE WHEN created_at >= NOW()-INTERVAL '7 days' THEN total ELSE 0 END) as weekly_revenue
         FROM orders WHERE payment_status='paid'`
      ),
    ])

    res.json({ success: true, data: {
      users: userCount.rows[0],
      vendors: vendorCount.rows,
      products: productCount.rows,
      orders: orderStats.rows[0],
      revenue: revenue.rows[0],
    }})
  } catch (err) { next(err) }
})

// ─── Vendor Approvals & Payouts (Marketplace Specific) ──────
adminRouter.get("/vendors", async (req, res, next) => {
  try {
    const { status = "pending", page = 1, limit = 20 } = req.query
    const offset = (Number(page) - 1) * Number(limit)
    const result = await db.query(
      `SELECT v.*, u.email, u.first_name, u.last_name, u.phone
       FROM vendors v JOIN users u ON v.user_id=u.id
       WHERE v.status=$1
       ORDER BY v.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, Number(limit), offset]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// GET /admin/vendors/:id — full vendor detail with stats
adminRouter.get("/vendors/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT v.*, u.email, u.first_name, u.last_name, u.phone, u.id as user_id,
        (SELECT COUNT(*) FROM products WHERE vendor_id = v.id) as product_count,
        (SELECT COUNT(*) FROM order_items WHERE vendor_id = v.id) as order_count,
        (SELECT COALESCE(SUM(oi.vendor_amount),0)
           FROM order_items oi JOIN orders o ON oi.order_id=o.id
           WHERE oi.vendor_id=v.id AND o.payment_status='paid') as total_revenue,
        (SELECT COALESCE(AVG(r.rating),0)
           FROM reviews r JOIN products p ON r.product_id=p.id
           WHERE p.vendor_id=v.id AND r.is_approved=true) as avg_rating,
        (SELECT JSON_AGG(row_to_json(t)) FROM (
           SELECT p2.id, p2.name, p2.sku, p2.price, p2.status,
             (SELECT url FROM product_images WHERE product_id=p2.id AND is_primary=true LIMIT 1) as image_url
           FROM products p2 WHERE p2.vendor_id=v.id
           ORDER BY p2.created_at DESC LIMIT 10
        ) t) as products
       FROM vendors v JOIN users u ON v.user_id=u.id
       WHERE v.id=$1`,
      [req.params.id]
    )
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Vendor not found" })
    }
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// PATCH /admin/vendors/:id/approve
adminRouter.patch("/vendors/:id/approve", async (req, res, next) => {
  try {
    const adminId = (req as any).user?.userId
    await db.query(
      "UPDATE vendors SET status='approved', approved_at=NOW(), approved_by=$1 WHERE id=$2",
      [adminId, req.params.id]
    )
    res.json({ success: true, message: "Vendor approved" })
  } catch (err) { next(err) }
})

// PATCH /admin/vendors/:id/suspend
adminRouter.patch("/vendors/:id/suspend", async (req, res, next) => {
  try {
    await db.query("UPDATE vendors SET status='suspended', updated_at=NOW() WHERE id=$1", [req.params.id])
    res.json({ success: true, message: "Vendor suspended" })
  } catch (err) { next(err) }
})

// PATCH /admin/vendors/:id/reset-password — admin force-change vendor password
adminRouter.patch("/vendors/:id/reset-password", async (req, res, next) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" })
    }
    // Get the user_id for this vendor
    const vendorResult = await db.query("SELECT user_id FROM vendors WHERE id=$1", [req.params.id])
    if (!vendorResult.rows[0]) {
      return res.status(404).json({ success: false, message: "Vendor not found" })
    }
    const bcrypt = await import("bcryptjs")
    const hash = await bcrypt.default.hash(newPassword, 12)
    await db.query(
      "UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2",
      [hash, vendorResult.rows[0].user_id]
    )
    res.json({ success: true, message: "Password updated successfully" })
  } catch (err) { next(err) }
})

adminRouter.get("/payouts", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT vp.*, v.store_name, v.bank_account_number, v.bank_ifsc, v.bank_account_name
       FROM vendor_payouts vp JOIN vendors v ON vp.vendor_id=v.id
       WHERE vp.status='pending'
       ORDER BY vp.created_at ASC`
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// ─── Core Medusa Resources (Regions, Collections) ───────────
adminRouter.get("/regions", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM regions ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/collections", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM collections ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.post("/collections", async (req, res, next) => {
  try {
    const { title, handle } = req.body
    const result = await db.query(
      "INSERT INTO collections (title, handle) VALUES ($1, $2) RETURNING *",
      [title, handle || title.toLowerCase().replace(/ /g, '-')]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

adminRouter.delete("/collections/:id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM collections WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Collection deleted" })
  } catch (err) { next(err) }
})

adminRouter.get("/categories", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM categories ORDER BY sort_order, name")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.post("/categories", async (req, res, next) => {
  try {
    const { name, handle, description, parent_id } = req.body
    const result = await db.query(
      "INSERT INTO categories (name, handle, description, parent_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, handle || name.toLowerCase().replace(/ /g, '-'), description, parent_id || null]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

adminRouter.patch("/categories/:id", async (req, res, next) => {
  try {
    const { name, handle, description, parent_id } = req.body
    const result = await db.query(
      "UPDATE categories SET name=COALESCE($1, name), handle=COALESCE($2, handle), description=COALESCE($3, description), parent_id=COALESCE($4, parent_id) WHERE id=$5 RETURNING *",
      [name, handle, description, parent_id, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

adminRouter.delete("/categories/:id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM categories WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Category deleted" })
  } catch (err) { next(err) }
})

// ─── Missing Routes (Stubs to avoid 404) ──────────────────────
adminRouter.get("/tags", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT id, value as name, color, created_at, updated_at FROM product_tags ORDER BY value")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.post("/tags", async (req, res, next) => {
  try {
    const { name, color, value } = req.body
    const tagValue = name || value
    const result = await db.query(
      "INSERT INTO product_tags (value, color) VALUES ($1, $2) ON CONFLICT (value) DO UPDATE SET color = EXCLUDED.color RETURNING id, value as name, color, created_at, updated_at",
      [tagValue, color || null]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

adminRouter.patch("/tags/:id", async (req, res, next) => {
  try {
    const { name, color, value } = req.body
    const tagValue = name || value
    const result = await db.query(
      "UPDATE product_tags SET value = COALESCE($1, value), color = COALESCE($2, color), updated_at = NOW() WHERE id = $3 RETURNING id, value as name, color, created_at, updated_at",
      [tagValue, color, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

adminRouter.delete("/tags/:id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM product_tags WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Tag deleted" })
  } catch (err) { next(err) }
})

adminRouter.get("/settings", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM store_settings LIMIT 1")
    res.json({ success: true, data: result.rows[0] || {} })
  } catch (err) { next(err) }
})

adminRouter.get("/returns", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM returns ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.patch("/returns/:id", async (req, res, next) => {
  try {
    const { status, refund_amount } = req.body
    const result = await db.query(
      "UPDATE returns SET status=COALESCE($1, status), refund_amount=COALESCE($2, refund_amount) WHERE id=$3 RETURNING *",
      [status, refund_amount, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

adminRouter.get("/notifications", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM notifications ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/claims", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM claims ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/swaps", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM swaps ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/gift-cards", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM gift_cards ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/price-lists", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM price_lists ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/sales-channels", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM sales_channels ORDER BY created_at DESC")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/shipping-options", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM shipping_options")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/tax-rates", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM tax_rates")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT id, email, first_name, last_name, role FROM users WHERE role = 'admin'")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

adminRouter.get("/customer-groups", async (_req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM customer_groups ORDER BY name")
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})
