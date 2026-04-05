import { Router } from "express"
import { DiscountService } from "../../services/discount.service"
import { db } from "../../db"
import { AppError } from "../../utils/AppError"

export const adminDiscountRouter = Router()

// GET /admin/discounts
adminDiscountRouter.get("/", async (req, res, next) => {
  try {
    const discounts = await DiscountService.listDiscounts()
    res.json({ success: true, data: discounts })
  } catch (err) { next(err) }
})

// POST /admin/discounts
adminDiscountRouter.post("/", async (req, res, next) => {
  try {
    const { code, type, value, ends_at, metadata, conditions } = req.body
    if (!code || !value) throw new AppError("Code and value are required", 400)
    
    const discount = await DiscountService.createDiscount({
      code, type, value, ends_at, metadata, conditions
    })
    res.status(201).json({ success: true, discount })
  } catch (err) { next(err) }
})

// POST /admin/discounts/:id/conditions
adminDiscountRouter.post("/:id/conditions", async (req, res, next) => {
  try {
    const { type, operator, val_ids = [] } = req.body
    if (!type || !val_ids.length) throw new AppError("type and val_ids are required", 400)
    
    const result = await db.query(
      "INSERT INTO discount_conditions (type, discount_rule_id, operator) VALUES ($1,$2,$3) RETURNING *",
      [type, req.params.id, operator || 'in']
    )
    res.json({ success: true, condition: result.rows[0] })
  } catch (err) { next(err) }
})

// PATCH /admin/discounts/:id
adminDiscountRouter.patch("/:id", async (req, res, next) => {
  try {
    const { code, is_disabled, ends_at } = req.body
    const result = await db.query(
      "UPDATE discounts SET code=COALESCE($1, code), is_disabled=COALESCE($2, is_disabled), ends_at=COALESCE($3, ends_at), updated_at=NOW() WHERE id=$4 RETURNING *",
      [code, is_disabled, ends_at, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// DELETE /admin/discounts/:id
adminDiscountRouter.delete("/:id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM discounts WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Discount deleted" })
  } catch (err) { next(err) }
})
