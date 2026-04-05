import { Router } from "express"
import { CustomerGroupService } from "../../services/customer-group.service"
import { db } from "../../db"
import { AppError } from "../../utils/AppError"

export const adminCustomerRouter = Router()

// GET /admin/customers
adminCustomerRouter.get("/", async (req, res, next) => {
  try {
    const { q, limit = 20, offset = 0, page = 1 } = req.query
    const search = q ? `%${q}%` : null
    
    // Get total count
    const countRes = await db.query(
      `SELECT COUNT(*) FROM users WHERE role = 'customer'
       AND ($1::text IS NULL OR email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)`,
      [search]
    )
    const total = parseInt(countRes.rows[0].count)

    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT JSON_AGG(cg) FROM customer_groups cg 
         JOIN customer_group_customers cgc ON cg.id = cgc.customer_group_id
         WHERE cgc.customer_id = u.id) as groups
       FROM users u WHERE role = 'customer'
       AND ($1::text IS NULL OR email ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [search, Number(limit), Number(offset)]
    )
    
    res.json({ 
      success: true, 
      data: {
        customers: result.rows,
        total,
        page: Number(page),
        limit: Number(limit)
      }
    })
  } catch (err) { next(err) }
})

// GET /admin/customer-groups
adminCustomerRouter.get("/groups", async (req, res, next) => {
  try {
    const groups = await CustomerGroupService.listGroups(req.query)
    res.json({ success: true, groups })
  } catch (err) { next(err) }
})

// POST /admin/customer-groups
adminCustomerRouter.post("/groups", async (req, res, next) => {
  try {
    const { name, metadata } = req.body
    if (!name) throw new AppError("Name is required", 400)
    const group = await CustomerGroupService.createGroup(name, metadata)
    res.status(201).json({ success: true, group })
  } catch (err) { next(err) }
})

// POST /admin/customer-groups/:id/batch
adminCustomerRouter.post("/groups/:id/batch", async (req, res, next) => {
  try {
    const { customer_ids } = req.body
    if (!Array.isArray(customer_ids)) throw new AppError("customer_ids must be an array", 400)
    
    for (const cid of customer_ids) {
      await CustomerGroupService.assignCustomer(cid, req.params.id)
    }
    res.json({ success: true, message: "Customers assigned to group" })
  } catch (err) { next(err) }
})
