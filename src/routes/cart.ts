import { Router } from "express"
import { db } from "../db"
import { AppError } from "../utils/AppError"
import { authenticate } from "../middleware/auth"

export const cartRouter = Router()

// GET /cart — fetch user's active cart
cartRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId

    const cartResult = await db.query(
      "SELECT id FROM carts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    )
    const cart = cartResult.rows[0]
    if (!cart) return res.json({ success: true, data: { items: [], subtotal: 0 } })

    const itemsResult = await db.query(
      `SELECT
        ci.id, ci.quantity, ci.unit_price,
        p.id as product_id, p.name, p.slug, p.stock_quantity,
        p.price as current_price,
        pv.id as variant_id, pv.title as variant_title,
        v.store_name as vendor_name, v.store_slug as vendor_slug,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       JOIN vendors v ON p.vendor_id = v.id
       WHERE ci.cart_id = $1`,
      [cart.id]
    )

    const subtotal = itemsResult.rows.reduce(
      (sum: number, item: any) => sum + item.unit_price * item.quantity, 0
    )

    res.json({ success: true, data: { cartId: cart.id, items: itemsResult.rows, subtotal } })
  } catch (err) { next(err) }
})

// POST /cart/items — add item
cartRouter.post("/items", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const { productId, variantId, quantity = 1 } = req.body
    if (!productId) throw new AppError("productId is required", 400)

    // Validate product
    const prodResult = await db.query(
      "SELECT id, price, stock_quantity, status FROM products WHERE id = $1",
      [productId]
    )
    const product = prodResult.rows[0]
    if (!product || product.status !== "active") throw new AppError("Product not available", 404)
    if (product.stock_quantity < quantity) throw new AppError("Insufficient stock", 400)

    // Get or create cart
    let cartResult = await db.query(
      "SELECT id FROM carts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    )
    let cartId: string
    if (!cartResult.rows[0]) {
      const newCart = await db.query(
        "INSERT INTO carts (user_id) VALUES ($1) RETURNING id",
        [userId]
      )
      cartId = newCart.rows[0].id
    } else {
      cartId = cartResult.rows[0].id
    }

    // Upsert cart item
    await db.query(
      `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit_price)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cart_id, product_id, variant_id)
       DO UPDATE SET quantity = cart_items.quantity + $4, updated_at = NOW()`,
      [cartId, productId, variantId || null, quantity, product.price]
    )

    res.status(201).json({ success: true, message: "Item added to cart" })
  } catch (err) { next(err) }
})

// PATCH /cart/items/:itemId — update quantity
cartRouter.patch("/items/:itemId", authenticate, async (req, res, next) => {
  try {
    const { itemId } = req.params
    const { quantity } = req.body
    if (!quantity || quantity < 1) throw new AppError("Quantity must be at least 1", 400)

    await db.query(
      "UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2",
      [quantity, itemId]
    )
    res.json({ success: true })
  } catch (err) { next(err) }
})

// DELETE /cart/items/:itemId — remove item
cartRouter.delete("/items/:itemId", authenticate, async (req, res, next) => {
  try {
    await db.query("DELETE FROM cart_items WHERE id = $1", [req.params.itemId])
    res.json({ success: true, message: "Item removed" })
  } catch (err) { next(err) }
})

// DELETE /cart — clear cart
cartRouter.delete("/", authenticate, async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const cartResult = await db.query("SELECT id FROM carts WHERE user_id = $1 LIMIT 1", [userId])
    if (cartResult.rows[0]) {
      await db.query("DELETE FROM cart_items WHERE cart_id = $1", [cartResult.rows[0].id])
    }
    res.json({ success: true, message: "Cart cleared" })
  } catch (err) { next(err) }
})
