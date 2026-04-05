import { Router } from "express"
import { db } from "../db"
import { ProductService } from "../services/product.service"
import { AppError } from "../utils/AppError"
import { authenticate, authorize } from "../middleware/auth"

export const vendorsRouter = Router()

// GET /vendors — list approved vendors
vendorsRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const params: any[] = ["approved"]
    let pi = 2
    const conditions = ["v.status = $1"]
    if (search) { conditions.push(`v.store_name ILIKE $${pi++}`); params.push(`%${search}%`) }
    const offset = (Number(page) - 1) * Number(limit)
    params.push(Number(limit), offset)

    const result = await db.query(
      `SELECT v.id, v.store_name, v.store_slug, v.description, v.logo_url,
        v.rating, v.rating_count, v.total_orders, v.total_sales, v.created_at
       FROM vendors v
       WHERE ${conditions.join(" AND ")}
       ORDER BY v.total_sales DESC
       LIMIT $${pi++} OFFSET $${pi++}`,
      params
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// GET /vendors/:slug — public vendor profile
vendorsRouter.get("/:slug", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT v.id, v.store_name, v.store_slug, v.description, v.logo_url, v.banner_url,
        v.rating, v.rating_count, v.total_orders, v.total_sales, v.created_at,
        u.first_name, u.last_name
       FROM vendors v JOIN users u ON v.user_id = u.id
       WHERE v.store_slug = $1 AND v.status = 'approved'`,
      [req.params.slug]
    )
    if (!result.rows[0]) throw new AppError("Vendor not found", 404)
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// POST /vendors/register — register as vendor
vendorsRouter.post("/register", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const { storeName, description, gstNumber, phone } = req.body
    if (!storeName) throw new AppError("Store name is required", 400)

    const existing = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    if (existing.rows[0]) throw new AppError("You already have a vendor account", 409)

    const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

    const result = await db.query(
      `INSERT INTO vendors (user_id, store_name, store_slug, description, gst_number)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, storeName, `${slug}-${Date.now()}`, description || null, gstNumber || null]
    )

    // Update user role
    await db.query("UPDATE users SET role = 'vendor' WHERE id = $1 AND role = 'customer'", [userId])

    res.status(201).json({
      success: true,
      message: "Vendor registration submitted. Awaiting admin approval.",
      data: result.rows[0],
    })
  } catch (err) { next(err) }
})

// GET /vendors/me/dashboard — vendor dashboard stats
vendorsRouter.get("/me/dashboard", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    if (!vendorResult.rows[0]) throw new AppError("Vendor not found", 404)
    const vendorId = vendorResult.rows[0].id

    const [productsCount, ordersStats, revenueStats, pendingPayouts] = await Promise.all([
      db.query("SELECT COUNT(*), status FROM products WHERE vendor_id=$1 GROUP BY status", [vendorId]),
      db.query(
        `SELECT COUNT(*) as total_orders, COUNT(*) FILTER(WHERE status='delivered') as delivered
         FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE oi.vendor_id=$1`,
        [vendorId]
      ),
      db.query(
        `SELECT
          SUM(vendor_amount) as total_revenue,
          SUM(CASE WHEN o.created_at >= NOW()-INTERVAL '30 days' THEN vendor_amount ELSE 0 END) as monthly_revenue
         FROM order_items oi JOIN orders o ON oi.order_id=o.id
         WHERE oi.vendor_id=$1 AND o.payment_status='paid'`,
        [vendorId]
      ),
      db.query(
        "SELECT SUM(net_amount) as pending FROM vendor_payouts WHERE vendor_id=$1 AND status='pending'",
        [vendorId]
      ),
    ])

    res.json({ success: true, data: {
      products: productsCount.rows,
      orders: ordersStats.rows[0],
      revenue: revenueStats.rows[0],
      pendingPayouts: pendingPayouts.rows[0]?.pending || 0,
    }})
  } catch (err) { next(err) }
})

// GET /vendors/me/orders — vendor's orders
vendorsRouter.get("/me/orders", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const { page = 1, limit = 20, status, orderId } = req.query
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    if (!vendorResult.rows[0]) throw new AppError("Vendor not found", 404)
    const vendorId = vendorResult.rows[0].id

    // If orderId is provided, return single order detail
    if (orderId) {
      const result = await db.query(
        `SELECT o.id, o.order_number, o.status, o.payment_status,
          o.total, o.created_at, o.shipping_address,
          COALESCE(u.email, o.email) as email,
          COALESCE(u.first_name, o.shipping_address->>'first_name') as first_name,
          COALESCE(u.last_name, o.shipping_address->>'last_name') as last_name,
          (SELECT JSON_AGG(jsonb_build_object(
            'id', oi_item.id,
            'name', oi_item.product_name,
            'variant', oi_item.variant_title,
            'quantity', oi_item.quantity,
            'price', oi_item.unit_price,
            'image_url', oi_item.image_url
          )) FROM order_items oi_item WHERE oi_item.order_id = o.id AND oi_item.vendor_id = $1) as items
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.id = $2 AND o.id IN (SELECT order_id FROM order_items WHERE vendor_id = $1)`,
        [vendorId, orderId]
      )
      if (!result.rows[0]) throw new AppError("Order not found", 404)
      return res.json({ success: true, data: result.rows[0] })
    }

    const params: any[] = [vendorId]
    let pi = 2
    const conditions = ["oi.vendor_id = $1"]
    if (status) { conditions.push(`o.status = $${pi++}`); params.push(status) }
    const offset = (Number(page) - 1) * Number(limit)
    params.push(Number(limit), offset)

    const where = conditions.filter(c => !c.includes('oi.vendor_id')).map(c => `AND ${c}`).join(' ')
    
    // Get total count for vendor orders
    const countRes = await db.query(
      `SELECT COUNT(DISTINCT o.id) 
       FROM orders o 
       WHERE o.id IN (SELECT order_id FROM order_items WHERE vendor_id = $1)
       ${where}`,
      params.slice(0, pi - 1)
    )
    const total = parseInt(countRes.rows[0].count)

    const result = await db.query(
      `SELECT o.id, o.order_number, o.status, o.payment_status,
        o.total, o.created_at, o.shipping_address,
        COALESCE(u.email, o.email) as email,
        COALESCE(u.first_name, o.shipping_address->>'first_name') as first_name,
        COALESCE(u.last_name, o.shipping_address->>'last_name') as last_name,
        (SELECT JSON_AGG(oi_item) FROM order_items oi_item WHERE oi_item.order_id = o.id AND oi_item.vendor_id = $1) as items
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id IN (SELECT order_id FROM order_items WHERE vendor_id = $1)
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${pi++} OFFSET $${pi++}`,
      params
    )
    res.json({ success: true, data: { orders: result.rows, total } })
  } catch (err) { next(err) }
})

// ─── Vendor Mini-Medusa Features ──────────────────────────────

// GET /me/inventory
vendorsRouter.get("/me/inventory", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const result = await db.query(
      `SELECT p.id, p.name, p.sku, p.stock_quantity, p.status,
              (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
       FROM products p
       WHERE p.vendor_id = $1
       ORDER BY p.stock_quantity ASC`,
      [vendorId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// GET /me/products
vendorsRouter.get("/me/products", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const result = await db.query(
      `SELECT p.*, 
        (SELECT JSON_AGG(jsonb_set(row_to_json(v)::jsonb, '{inventory_quantity}', to_jsonb(v.stock_quantity))) FROM product_variants v WHERE v.product_id = p.id) as variants,
        (SELECT JSON_AGG(i ORDER BY i.sort_order) FROM product_images i WHERE i.product_id = p.id) as images,
        (SELECT JSON_AGG(o ORDER BY o.created_at) FROM product_options o WHERE o.product_id = p.id) as options,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as thumbnail,
        c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.vendor_id = $1
       ORDER BY p.created_at DESC`,
      [vendorId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// GET /me/products/:id
vendorsRouter.get("/me/products/:id", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const result = await db.query(
      `SELECT p.*, 
        (SELECT JSON_AGG(jsonb_set(row_to_json(v)::jsonb, '{inventory_quantity}', to_jsonb(v.stock_quantity))) FROM product_variants v WHERE v.product_id = p.id) as variants,
        (SELECT JSON_AGG(i ORDER BY i.sort_order) FROM product_images i WHERE i.product_id = p.id) as images,
        (SELECT JSON_AGG(o ORDER BY o.created_at) FROM product_options o WHERE o.product_id = p.id) as options,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as thumbnail,
        c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1 AND p.vendor_id = $2`,
      [req.params.id, vendorId]
    )
    if (!result.rows[0]) throw new AppError("Product not found", 404)
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// PATCH /me/order-items/:id/fulfillment
vendorsRouter.patch("/me/order-items/:id/fulfillment", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const { tracking_number } = req.body
    const result = await db.query(
      "UPDATE order_items SET fulfillment_status = 'fulfilled', tracking_number = $1 WHERE id = $2 AND vendor_id = $3 RETURNING *",
      [tracking_number, req.params.id, vendorId]
    )
    
    if (!result.rows[0]) throw new AppError("Order item not found or access denied", 404)
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// GET /me/returns
vendorsRouter.get("/me/returns", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const result = await db.query(
      `SELECT r.*, o.order_number FROM returns r
       JOIN orders o ON r.order_id = o.id
       WHERE o.id IN (SELECT order_id FROM order_items WHERE vendor_id = $1)
       ORDER BY r.created_at DESC`,
      [vendorId]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// ─── Vendor Variant Management ────────────────────────────────

// POST /me/products/:id/options (Vendor creating "Size", "Color")
vendorsRouter.post("/me/products/:id/options", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    // Ownership check
    const checkResult = await db.query("SELECT id FROM products WHERE id = $1 AND vendor_id = $2", [req.params.id, vendorId])
    if (!checkResult.rows[0]) throw new AppError("Product not found or access denied", 403)

    const { title, values = [] } = req.body
    const result = await db.query(
      "INSERT INTO product_options (title, product_id, metadata) VALUES ($1,$2,$3) RETURNING *",
      [title, req.params.id, JSON.stringify({ values })]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// DELETE /me/products/:id/options/:oid
vendorsRouter.delete("/me/products/:id/options/:oid", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    // Ownership check
    const checkResult = await db.query("SELECT id FROM products WHERE id = $1 AND vendor_id = $2", [req.params.id, vendorId])
    if (!checkResult.rows[0]) throw new AppError("Product access denied", 403)

    await db.query("DELETE FROM product_options WHERE id = $1 AND product_id = $2", [req.params.oid, req.params.id])
    res.json({ success: true, message: "Option deleted" })
  } catch (err) { next(err) }
})

// PATCH /me/products/:id/options/:oid (Vendor updating an option title/values)
vendorsRouter.patch("/me/products/:id/options/:oid", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    // Ownership check
    const checkResult = await db.query("SELECT id FROM products WHERE id = $1 AND vendor_id = $2", [req.params.id, vendorId])
    if (!checkResult.rows[0]) throw new AppError("Product access denied", 403)

    const { title, values = [] } = req.body
    const result = await db.query(
      "UPDATE product_options SET title = COALESCE($1, title), metadata = $2, updated_at = NOW() WHERE id = $3 AND product_id = $4 RETURNING *",
      [title, JSON.stringify({ values }), req.params.oid, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// POST /me/products/:id/variants (Vendor creating a specific variant)
vendorsRouter.post("/me/products/:id/variants", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const checkResult = await db.query("SELECT id FROM products WHERE id = $1 AND vendor_id = $2", [req.params.id, vendorId])
    if (!checkResult.rows[0]) throw new AppError("Product not found or access denied", 403)

    const variant = await ProductService.createVariant(req.params.id, req.body)
    res.status(201).json({ success: true, data: variant })
  } catch (err) { next(err) }
})

// PATCH /me/variants/:vid (Update variant)
vendorsRouter.patch("/me/variants/:vid", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    // Ownership check
    const checkResult = await db.query(
      "SELECT pv.id FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = $1 AND p.vendor_id = $2",
      [req.params.vid, vendorId]
    )
    if (!checkResult.rows[0]) throw new AppError("Variant not found", 404)

    const variant = await ProductService.updateVariant(req.params.vid, req.body)
    res.json({ success: true, data: variant })
  } catch (err) { next(err) }
})

// DELETE /me/variants/:vid (Delete variant)
vendorsRouter.delete("/me/variants/:vid", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const checkResult = await db.query(
      "SELECT pv.id FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = $1 AND p.vendor_id = $2",
      [req.params.vid, vendorId]
    )
    if (!checkResult.rows[0]) throw new AppError("Variant access denied", 403)

    await db.query("DELETE FROM product_variants WHERE id = $1", [req.params.vid])
    res.json({ success: true, message: "Variant deleted" })
  } catch (err) { next(err) }
})

// ─── Vendor-Specific Discounts ──────────────────────────────
vendorsRouter.get("/me/discounts", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const result = await db.query("SELECT * FROM discounts WHERE vendor_id = $1 ORDER BY created_at DESC", [vendorId])
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

vendorsRouter.post("/me/discounts", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const { code, type, value, ends_at } = req.body
    const result = await db.query(
      `INSERT INTO discounts (code, type, value, ends_at, vendor_id, is_active)
       VALUES ($1,$2,$3,$4,$5, true) RETURNING *`,
      [code.toUpperCase(), type || 'percentage', value, ends_at || null, vendorId]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// ─── Vendor Price Lists (Sales) ──────────────────────────────
vendorsRouter.get("/me/price-lists", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const result = await db.query("SELECT * FROM price_lists WHERE vendor_id = $1 ORDER BY created_at DESC", [vendorId])
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

vendorsRouter.post("/me/price-lists", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    const vendorId = vendorResult.rows[0].id

    const { name, description, starts_at, ends_at } = req.body
    const result = await db.query(
      "INSERT INTO price_lists (name, description, starts_at, ends_at, vendor_id) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, description || null, starts_at || null, ends_at || null, vendorId]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// ─── Vendor Batch Jobs (Imports) ─────────────────────────────
vendorsRouter.get("/me/batch-jobs", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const result = await db.query("SELECT * FROM batch_jobs WHERE created_by = $1 ORDER BY created_at DESC", [userId])
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

vendorsRouter.post("/me/batch-jobs", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const { type, context } = req.body
    const result = await db.query(
      "INSERT INTO batch_jobs (type, context, created_by) VALUES ($1,$2,$3) RETURNING *",
      [type, context || {}, userId]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// ─── Vendor Settings ───────────────────────────────────────────
vendorsRouter.patch("/me", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const { store_name, description, logo_url, banner_url } = req.body

    const result = await db.query(
      `UPDATE vendors SET 
        store_name = COALESCE($1, store_name),
        description = COALESCE($2, description),
        logo_url = COALESCE($3, logo_url),
        banner_url = COALESCE($4, banner_url),
        updated_at = NOW()
       WHERE user_id = $5 RETURNING *`,
      [store_name, description, logo_url, banner_url, userId]
    )

    if (!result.rows[0]) throw new AppError("Vendor not found", 404)
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})
