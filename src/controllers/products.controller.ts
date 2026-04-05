import { Request, Response, NextFunction } from "express"
import { db } from "../db"
import { ProductService } from "../services/product.service"
import { InventoryService } from "../services/inventory.service"
import { AppError } from "../utils/AppError"

// ─── GET /products ────────────────────────────────────────────
export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      vendor,
      search,
      minPrice,
      maxPrice,
      sort = "created_at",
      order = "DESC",
      featured,
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)
    const conditions: string[] = ["p.status = 'active'"]
    const params: any[] = []
    let paramIdx = 1

    if (category) {
      conditions.push(`c.slug = $${paramIdx++}`)
      params.push(category)
    }
    if (vendor) {
      conditions.push(`v.store_slug = $${paramIdx++}`)
      params.push(vendor)
    }
    if (search) {
      conditions.push(`(to_tsvector('english', p.name) @@ plainto_tsquery('english', $${paramIdx++}) OR p.name ILIKE $${paramIdx++})`)
      params.push(search, `%${search}%`)
    }
    if (minPrice) {
      conditions.push(`p.price >= $${paramIdx++}`)
      params.push(Number(minPrice))
    }
    if (maxPrice) {
      conditions.push(`p.price <= $${paramIdx++}`)
      params.push(Number(maxPrice))
    }
    if (featured === "true") {
      conditions.push(`p.is_featured = TRUE`)
    }

    const allowedSorts: Record<string, string> = {
      price: "p.price",
      rating: "p.rating",
      created_at: "p.created_at",
      total_sold: "p.total_sold",
    }
    const sortColumn = allowedSorts[sort as string] || "p.created_at"
    const sortOrder = order === "ASC" ? "ASC" : "DESC"

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    const countResult = await db.query(
      `SELECT COUNT(*) FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN vendors v ON p.vendor_id = v.id
       ${whereClause}`,
      params
    )

    const total = parseInt(countResult.rows[0].count)

    params.push(Number(limit), offset)
    const result = await db.query(
      `SELECT
        p.id, p.name, p.slug, p.short_description, p.price, p.compare_at_price,
        p.stock_quantity, p.rating, p.rating_count, p.total_sold, p.is_featured,
        p.tags, p.created_at,
        c.name as category_name, c.slug as category_slug,
        v.store_name as vendor_name, v.store_slug as vendor_slug,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) as image_url
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN vendors v ON p.vendor_id = v.id
       ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      params
    )

    res.json({
      success: true,
      data: {
        products: result.rows,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /products/:slug ─────────────────────────────────────
export async function getProductBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params

    const result = await db.query(
      `SELECT
        p.*,
        c.name as category_name, c.slug as category_slug,
        v.store_name as vendor_name, v.store_slug as vendor_slug,
        v.rating as vendor_rating, v.total_orders as vendor_total_orders
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN vendors v ON p.vendor_id = v.id
       WHERE p.slug = $1 AND p.status = 'active'`,
      [slug]
    )

    if (!result.rows[0]) throw new AppError("Product not found", 404)

    const product = result.rows[0]

    // Get images
    const imagesResult = await db.query(
      "SELECT id, url, alt_text, is_primary, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order",
      [product.id]
    )

    // Get variants
    const variantsResult = await db.query(
      "SELECT id, title, sku, price, stock_quantity, attributes FROM product_variants WHERE product_id = $1 AND is_active = TRUE",
      [product.id]
    )

    // Get top reviews
    const reviewsResult = await db.query(
      `SELECT r.id, r.rating, r.title, r.body, r.is_verified, r.helpful_count, r.created_at,
        u.first_name, u.last_name, u.avatar_url
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1 AND r.is_approved = TRUE
       ORDER BY r.helpful_count DESC, r.created_at DESC
       LIMIT 10`,
      [product.id]
    )

    // Increment view count (fire and forget)
    db.query("UPDATE products SET view_count = view_count + 1 WHERE id = $1", [product.id]).catch(() => {})

    res.json({
      success: true,
      data: {
        ...product,
        images: imagesResult.rows,
        variants: variantsResult.rows,
        reviews: reviewsResult.rows,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /products (vendor) ──────────────────────────────────
export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const {
      name, description, shortDescription, categoryId, collectionId, price,
      compareAtPrice, costPrice, stockQuantity, weightGrams,
      tags, attributes, isDigital, handle, material, hsCode
    } = req.body

    // Get vendor for this user
    const vendorResult = await db.query(
      "SELECT id FROM vendors WHERE user_id = $1 AND status = 'approved'",
      [userId]
    )
    if (!vendorResult.rows[0]) throw new AppError("Vendor not found or not approved", 403)

    const vendorId = vendorResult.rows[0].id

    // Use ProductService to handle dynamic field mapping, enterprise fields, and auto-variant/inventory creation
    const product = await ProductService.createProduct({
      ...req.body,
      vendor_id: vendorId,
    })

    res.status(201).json({ success: true, data: product })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /products/:id (vendor) ────────────────────────────
export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const userId = (req as any).user?.userId

    // Ownership check
    const ownerCheck = await db.query(
      `SELECT p.id FROM products p
       JOIN vendors v ON p.vendor_id = v.id
       WHERE p.id = $1 AND v.user_id = $2`,
      [id, userId]
    )
    if (!ownerCheck.rows[0]) throw new AppError("Product not found or access denied", 403)

    const product = await ProductService.updateProduct(id, req.body)
    if (!product) throw new AppError("No valid fields to update", 400)

    res.json({ success: true, data: product })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /products/:id (vendor) ───────────────────────────
export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params
    const userId = (req as any).user?.userId

    const ownerCheck = await db.query(
      `SELECT p.id FROM products p
       JOIN vendors v ON p.vendor_id = v.id
       WHERE p.id = $1 AND v.user_id = $2`,
      [id, userId]
    )
    if (!ownerCheck.rows[0]) throw new AppError("Product not found or access denied", 403)

    await db.query("UPDATE products SET status = 'archived' WHERE id = $1", [id])
    res.json({ success: true, message: "Product archived successfully" })
  } catch (err) {
    next(err)
  }
}
