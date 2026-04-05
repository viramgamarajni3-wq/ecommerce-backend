import { Router } from "express"
import {
  getProducts, getProductBySlug, createProduct, updateProduct, deleteProduct
} from "../controllers/products.controller"
import { authenticate, authorize, optionalAuth } from "../middleware/auth"
import { db } from "../db"

export const productsRouter = Router()

productsRouter.get("/", optionalAuth, getProducts)
productsRouter.get("/:slug", optionalAuth, getProductBySlug)
productsRouter.post("/", authenticate, authorize("vendor", "admin"), createProduct)
productsRouter.patch("/:id", authenticate, authorize("vendor", "admin"), updateProduct)
productsRouter.delete("/:id", authenticate, authorize("vendor", "admin"), deleteProduct)

// ─── Variant Images (Enterprise Visuals) ──────────────────
productsRouter.get("/:id/variants/:vid/images", optionalAuth, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT i.* FROM product_images i
       JOIN product_variant_images pvi ON i.id = pvi.image_id
       WHERE pvi.variant_id = $1`,
      [req.params.vid]
    )
    res.json({ success: true, data: result.rows })
  } catch (err) { next(err) }
})

productsRouter.post("/:id/variants/:vid/images", authenticate, authorize("vendor", "admin"), async (req, res, next) => {
  try {
    const { image_ids = [] } = req.body
    for (const image_id of image_ids) {
      await db.query(
        "INSERT INTO product_variant_images (variant_id, image_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [req.params.vid, image_id]
      )
    }
    res.json({ success: true, message: "Linked" })
  } catch (err) { next(err) }
})

productsRouter.delete("/:id/variants/:vid/images/:iid", authenticate, authorize("vendor", "admin"), async (req, res, next) => {
  try {
    await db.query("DELETE FROM product_variant_images WHERE variant_id = $1 AND image_id = $2", [req.params.vid, req.params.iid])
    res.json({ success: true, message: "Unlinked" })
  } catch (err) { next(err) }
})
