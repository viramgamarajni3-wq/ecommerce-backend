import { Router } from "express"
import { db } from "../db"
import { AppError } from "../utils/AppError"
import { authenticate, authorize } from "../middleware/auth"

export const reviewsRouter = Router()

// GET /reviews?productId=xxx
reviewsRouter.get("/", async (req, res, next) => {
  try {
    const { productId, page = 1, limit = 10 } = req.query
    if (!productId) throw new AppError("productId is required", 400)
    const offset = (Number(page) - 1) * Number(limit)

    const result = await db.query(
      `SELECT r.id, r.rating, r.title, r.body, r.is_verified, r.helpful_count, r.created_at,
        u.first_name, u.last_name, u.avatar_url
       FROM reviews r JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1 AND r.is_approved = TRUE
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, Number(limit), offset]
    )

    const stats = await db.query(
      `SELECT
        AVG(rating)::DECIMAL(3,2) as avg_rating,
        COUNT(*) as total,
        COUNT(*) FILTER(WHERE rating=5) as five_star,
        COUNT(*) FILTER(WHERE rating=4) as four_star,
        COUNT(*) FILTER(WHERE rating=3) as three_star,
        COUNT(*) FILTER(WHERE rating=2) as two_star,
        COUNT(*) FILTER(WHERE rating=1) as one_star
       FROM reviews WHERE product_id=$1 AND is_approved=TRUE`,
      [productId]
    )

    res.json({ success: true, data: { reviews: result.rows, stats: stats.rows[0] } })
  } catch (err) { next(err) }
})

// POST /reviews — submit review (must be a buyer)
reviewsRouter.post("/", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const { productId, orderId, rating, title, body } = req.body

    if (!productId || !rating) throw new AppError("productId and rating are required", 400)
    if (rating < 1 || rating > 5) throw new AppError("Rating must be between 1 and 5", 400)

    // Verify purchase
    let isVerified = false
    if (orderId) {
      const purchaseCheck = await db.query(
        `SELECT oi.id FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.user_id=$1 AND oi.product_id=$2 AND o.id=$3 AND o.status='delivered'`,
        [userId, productId, orderId]
      )
      isVerified = purchaseCheck.rows.length > 0
    }

    const result = await db.query(
      `INSERT INTO reviews (product_id, user_id, order_id, rating, title, body, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (product_id, user_id, order_id) DO UPDATE SET rating=$4, title=$5, body=$6
       RETURNING *`,
      [productId, userId, orderId || null, rating, title || null, body || null, isVerified]
    )

    res.status(201).json({ success: true, data: result.rows[0], message: "Review submitted for approval" })
  } catch (err) { next(err) }
})

// PATCH /reviews/:id/helpful — mark as helpful
reviewsRouter.patch("/:id/helpful", async (req, res, next) => {
  try {
    await db.query("UPDATE reviews SET helpful_count=helpful_count+1 WHERE id=$1", [req.params.id])
    res.json({ success: true })
  } catch (err) { next(err) }
})

// PATCH /reviews/:id/approve — admin approve
reviewsRouter.patch("/:id/approve", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    await db.query("UPDATE reviews SET is_approved=TRUE WHERE id=$1", [req.params.id])
    res.json({ success: true, message: "Review approved" })
  } catch (err) { next(err) }
})
