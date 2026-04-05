import { Router } from "express"
import { db } from "../../db"

export const adminInventoryRouter = Router()

// GET /admin/inventory
adminInventoryRouter.get("/", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.sku, p.stock_quantity, p.status,
              v.store_name as vendor_name, c.name as category_name,
              (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
       FROM products p
       LEFT JOIN vendors v ON p.vendor_id = v.id
       LEFT JOIN categories c ON p.category_id = c.id
       ORDER BY p.stock_quantity ASC`
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// PATCH /admin/inventory/:id
adminInventoryRouter.patch("/:id", async (req, res, next) => {
  try {
    const { stock_quantity } = req.body
    const result = await db.query(
      "UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING *",
      [stock_quantity, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})
