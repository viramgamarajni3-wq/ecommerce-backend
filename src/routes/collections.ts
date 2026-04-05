import { Router } from "express"
import { db } from "../db"

export const collectionsRouter = Router()

// GET /api/v1/collections (Public/Shared)
collectionsRouter.get("/", async (_req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM collections ORDER BY title ASC"
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

// GET /api/v1/collections/:id
collectionsRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT * FROM collections WHERE id = $1",
      [req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})
