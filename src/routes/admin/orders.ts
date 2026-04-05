import { Router } from "express"
import { db } from "../../db"

export const adminOrderRouter = Router()

// GET /admin/orders
adminOrderRouter.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query
    const params: any[] = []
    let pi = 1
    const conditions: string[] = []
    
    if (status) { conditions.push(`o.status=$${pi++}`); params.push(status) }
    if (search) { 
      conditions.push(`(o.order_number ILIKE $${pi++} OR u.email ILIKE $${pi++} OR u.first_name ILIKE $${pi++})`)
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    
    // Get total count
    const countRes = await db.query(
      `SELECT COUNT(*) FROM orders o LEFT JOIN users u ON o.user_id=u.id ${where}`,
      params.slice(0, pi - 1)
    )
    const total = parseInt(countRes.rows[0].count)

    const offset = (Number(page) - 1) * Number(limit)
    params.push(Number(limit), offset)

    const result = await db.query(
      `SELECT o.*, 
        COALESCE(u.email, o.email) as email,
        COALESCE(u.first_name, o.shipping_address->>'first_name') as first_name,
        COALESCE(u.last_name, o.shipping_address->>'last_name') as last_name,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ${where} ORDER BY o.created_at DESC LIMIT $${pi++} OFFSET $${pi++}`,
      params
    )

    res.json({ 
      success: true, 
      data: {
        orders: result.rows,
        total,
        page: Number(page),
        limit: Number(limit)
      }
    })
  } catch (err) { next(err) }
})

// GET /admin/orders/:id
adminOrderRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT o.*, 
              COALESCE(u.email, o.email) as email,
              COALESCE(u.first_name, o.shipping_address->>'first_name') as first_name,
              COALESCE(u.last_name, o.shipping_address->>'last_name') as last_name,
              u.phone as user_phone,
              (SELECT JSON_AGG(i) FROM order_items i WHERE i.order_id = o.id) as items
       FROM orders o LEFT JOIN users u ON o.user_id=u.id
       WHERE o.id = $1`,
      [req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// PATCH /admin/orders/:id/status
adminOrderRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const { status, payment_status, fulfillment_status } = req.body
    const result = await db.query(
      `UPDATE orders SET 
        status = COALESCE($1, status),
        payment_status = COALESCE($2, payment_status),
        fulfillment_status = COALESCE($3, fulfillment_status)
       WHERE id = $4 RETURNING *`,
      [status, payment_status, fulfillment_status, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})
