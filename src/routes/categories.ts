import { Router } from "express"
import { db } from "../db"

export const categoriesRouter = Router()

// GET /api/v1/categories (Public/Shared)
categoriesRouter.get("/", async (_req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM categories ORDER BY sort_order, name"
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// GET /api/v1/categories/:id
categoriesRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM categories WHERE id = $1",
      [req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})
