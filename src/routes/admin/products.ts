import { Router } from "express"
import { ProductService } from "../../services/product.service"
import { InventoryService } from "../../services/inventory.service"
import { AppError } from "../../utils/AppError"
import { db } from "../../db"

export const adminProductRouter = Router()

// GET /admin/products
adminProductRouter.get("/", async (req, res, next) => {
  try {
    const { q, limit, offset, page } = req.query
    const result = await ProductService.listProducts({
      q: q as string,
      limit: Number(limit) || 20,
      offset: Number(offset) || 0
    })
    
    // Wrap result in 'data' and map 'count' to 'total' for frontend parity
    res.json({ 
      success: true, 
      data: {
        products: result.products,
        total: result.count,
        page: Number(page) || 1,
        limit: Number(limit) || 20
      }
    })
  } catch (err) { next(err) }
})

// POST /admin/products
adminProductRouter.post("/", async (req, res, next) => {
  try {
    const adminId = (req as any).user?.userId

    // If no vendor_id provided, default to the admin's own vendor if it exists
    if (!req.body.vendor_id && adminId) {
      const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [adminId])
      if (vendorResult.rows[0]) {
        req.body.vendor_id = vendorResult.rows[0].id
      }
    }

    if (!req.body.vendor_id) {
       throw new AppError("Vendor ID is mandatory for product creation. Please select a vendor.", 400)
    }

    const product = await ProductService.createProduct(req.body)
    res.status(201).json({ success: true, data: product })
  } catch (err) { next(err) }
})

// GET /admin/products/:id
adminProductRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.*, 
        (SELECT JSON_AGG(jsonb_set(row_to_json(v)::jsonb, '{inventory_quantity}', to_jsonb(v.stock_quantity))) FROM product_variants v WHERE v.product_id = p.id) as variants,
        (SELECT JSON_AGG(i ORDER BY i.sort_order) FROM product_images i WHERE i.product_id = p.id) as images,
        (SELECT JSON_AGG(o ORDER BY o.created_at) FROM product_options o WHERE o.product_id = p.id) as options,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as thumbnail,
        v.store_name as vendor_name
       FROM products p 
       LEFT JOIN vendors v ON p.vendor_id = v.id
       WHERE p.id = $1`,
      [req.params.id]
    )
    if (!result.rows[0]) throw new AppError("Product not found", 404)
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// PATCH /admin/products/:id
adminProductRouter.patch("/:id", async (req, res, next) => {
  try {
    const product = await ProductService.updateProduct(req.params.id, req.body)
    if (!product) throw new AppError("Product update failed or no valid fields provided", 400)
    res.json({ success: true, data: product })
  } catch (err) { next(err) }
})

// DELETE /admin/products/:id
adminProductRouter.delete("/:id", async (req, res, next) => {
  try {
    await db.query("UPDATE products SET status = 'archived' WHERE id = $1", [req.params.id])
    res.json({ success: true, message: "Product archived" })
  } catch (err) { next(err) }
})

// ─── Product Variants (Admin) ──────────────────────────────
// POST /admin/products/:id/variants
adminProductRouter.post("/:id/variants", async (req, res, next) => {
  try {
    const variant = await ProductService.createVariant(req.params.id, req.body)
    res.status(201).json({ success: true, data: variant })
  } catch (err) { next(err) }
})

// PATCH /admin/products/:id/variants/:vid
adminProductRouter.patch("/:id/variants/:vid", async (req, res, next) => {
  try {
    const variant = await ProductService.updateVariant(req.params.vid, req.body)
    if (!variant) throw new AppError("Variant update failed", 400)
    res.json({ success: true, data: variant })
  } catch (err) { next(err) }
})

// DELETE /admin/products/:id/variants/:vid
adminProductRouter.delete("/:id/variants/:vid", async (req, res, next) => {
  try {
    await db.query("DELETE FROM product_variants WHERE id = $1 AND product_id = $2", [req.params.vid, req.params.id])
    res.json({ success: true, message: "Variant deleted" })
  } catch (err) { next(err) }
})

// ─── Product Options (Admin) ───────────────────────────────
// POST /admin/products/:id/options
adminProductRouter.post("/:id/options", async (req, res, next) => {
  try {
    const { name, values = [] } = req.body
    const result = await db.query(
      "INSERT INTO product_options (title, product_id, metadata) VALUES ($1,$2,$3) RETURNING *",
      [name, req.params.id, JSON.stringify({ values })]
    )
    res.status(201).json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})

// DELETE /admin/products/:id/options/:oid
adminProductRouter.delete("/:id/options/:oid", async (req, res, next) => {
  try {
    await db.query("DELETE FROM product_options WHERE id = $1 AND product_id = $2", [req.params.oid, req.params.id])
    res.json({ success: true, message: "Option deleted" })
  } catch (err) { next(err) }
})

// PATCH /admin/products/:id/options/:oid
adminProductRouter.patch("/:id/options/:oid", async (req, res, next) => {
  try {
    const { name, values = [] } = req.body
    const result = await db.query(
      "UPDATE product_options SET title = COALESCE($1, title), metadata = $2, updated_at = NOW() WHERE id = $3 AND product_id = $4 RETURNING *",
      [name, JSON.stringify({ values }), req.params.oid, req.params.id]
    )
    res.json({ success: true, data: result.rows[0] })
  } catch (err) { next(err) }
})
// ─── Variant-wise Images (Medusa Visuals) ──────────────────
// GET /admin/products/:id/variants/:vid/images
adminProductRouter.get("/:id/variants/:vid/images", async (req, res, next) => {
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

// POST /admin/products/:id/variants/:vid/images
adminProductRouter.post("/:id/variants/:vid/images", async (req, res, next) => {
  try {
    const { image_ids = [] } = req.body
    for (const image_id of image_ids) {
      await db.query(
        "INSERT INTO product_variant_images (variant_id, image_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [req.params.vid, image_id]
      )
    }
    res.json({ success: true, message: "Images linked to variant" })
  } catch (err) { next(err) }
})

// DELETE /admin/products/:id/variants/:vid/images/:iid
adminProductRouter.delete("/:id/variants/:vid/images/:iid", async (req, res, next) => {
  try {
    await db.query(
      "DELETE FROM product_variant_images WHERE variant_id = $1 AND image_id = $2",
      [req.params.vid, req.params.iid]
    )
    res.json({ success: true, message: "Image unlinked" })
  } catch (err) { next(err) }
})
