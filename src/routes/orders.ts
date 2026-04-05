import { Router } from "express"
import { db } from "../db"
import { AppError } from "../utils/AppError"
import { authenticate, authorize } from "../middleware/auth"

export const ordersRouter = Router()

// GET /orders — get my orders
ordersRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const { page = 1, limit = 10, status } = req.query

    const conditions = ["o.user_id = $1"]
    const params: any[] = [userId]
    let pi = 2

    if (status) { conditions.push(`o.status = $${pi++}`); params.push(status) }

    const offset = (Number(page) - 1) * Number(limit)
    params.push(Number(limit), offset)

    const result = await db.query(
      `SELECT
        o.id, o.order_number, o.status, o.payment_status,
        o.subtotal, o.discount_amount, o.shipping_amount, o.tax_amount, o.total,
        o.created_at, o.shipping_address,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
       FROM orders o
       WHERE ${conditions.join(" AND ")}
       ORDER BY o.created_at DESC
       LIMIT $${pi++} OFFSET $${pi++}`,
      params
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// GET /orders/:id — single order detail
ordersRouter.get("/:id", authenticate, async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = (req as any).user?.userId
    const user = (req as any).user

    const orderResult = await db.query(
      "SELECT * FROM orders WHERE id = $1",
      [id]
    )
    const order = orderResult.rows[0]
    if (!order) throw new AppError("Order not found", 404)

    // Customers can only see their own orders
    if (user.role === "customer" && order.user_id !== userId) {
      throw new AppError("Order not found", 404)
    }

    const itemsResult = await db.query(
      `SELECT
        oi.*,
        (SELECT url FROM product_images WHERE product_id = oi.product_id AND is_primary = TRUE LIMIT 1) as image_url,
        v.store_name as vendor_name, v.store_slug as vendor_slug
       FROM order_items oi
       JOIN vendors v ON oi.vendor_id = v.id
       WHERE oi.order_id = $1`,
      [id]
    )

    res.json({ success: true, data: { ...order, items: itemsResult.rows } })
  } catch (err) { next(err) }
})

// PATCH /orders/:id/status — admin/vendor update order status
ordersRouter.patch("/:id/status", authenticate, authorize("admin", "vendor"), async (req, res, next) => {
  try {
    const { id } = req.params
    const { status, trackingNumber } = req.body
    const validStatuses = ["confirmed","processing","shipped","delivered","cancelled"]
    if (!validStatuses.includes(status)) throw new AppError("Invalid status", 400)

    await db.query(
      `UPDATE orders SET 
        status = $1::order_status, 
        tracking_number = COALESCE($2, tracking_number),
        shipped_at = CASE WHEN $1::text = 'shipped' THEN NOW() ELSE shipped_at END,
        delivered_at = CASE WHEN $1::text = 'delivered' THEN NOW() ELSE delivered_at END
       WHERE id = $3`,
      [status, trackingNumber || null, id]
    )

    res.json({ success: true, message: "Order status updated" })
  } catch (err) { next(err) }
})
