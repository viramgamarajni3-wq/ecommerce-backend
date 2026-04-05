import { db } from "../db"
import { InventoryService } from "./inventory.service"

export class ProductService {
  /**
   * List all products with Medusa-level relations (Variants, Images, Options)
   */
  static async listProducts(params: { limit?: number; offset?: number; q?: string } = {}) {
    const { limit = 20, offset = 0, q } = params
    const conditions = ["p.status != 'archived'"]
    const args: any[] = [limit, offset]
    let pi = 3

    if (q) {
      conditions.push(`(p.name ILIKE $${pi} OR p.description ILIKE $${pi} OR p.handle ILIKE $${pi})`)
      args.push(`%${q}%`)
      pi++
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    
    const result = await db.query(
      `SELECT p.*, 
        (SELECT JSON_AGG(jsonb_set(row_to_json(v)::jsonb, '{inventory_quantity}', to_jsonb(v.stock_quantity))) FROM product_variants v WHERE v.product_id = p.id) as variants,
        (SELECT JSON_AGG(i ORDER BY i.sort_order) FROM product_images i WHERE i.product_id = p.id) as images,
        (SELECT JSON_AGG(o ORDER BY o.created_at) FROM product_options o WHERE o.product_id = p.id) as options,
        (SELECT url FROM product_images WHERE product_id = p.id AND is_primary = true LIMIT 1) as thumbnail,
        c.name as category_name,
        cl.title as collection_title,
        vnd.store_name as vendor_name,
        vnd.id as vendor_id_ref
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN collections cl ON p.collection_id = cl.id
       LEFT JOIN vendors vnd ON p.vendor_id = vnd.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      args
    )

    const countRes = await db.query(`SELECT COUNT(*) FROM products p ${where}`, args.slice(2))
    return {
      products: result.rows,
      count: parseInt(countRes.rows[0].count)
    }
  }

  /**
   * Create product with Medusa Enterprise fields
   */
  static async createProduct(data: any) {
    const allowedFields = [
      "name", "handle", "subtitle", "description", "short_description", "material", "origin_country",
      "hs_code", "mid_code", "weight_grams", "length_mm", "height_mm", "width_mm", 
      "status", "metadata", "category_id", "collection_id", "vendor_id", "is_featured", "is_digital",
      "price", "compare_at_price", "cost_price", "stock_quantity", "low_stock_threshold",
      "is_giftcard", "tags", "sku", "attributes",
      // Hardware Fields
      "brand", "model", "warranty", "condition",
      "processor", "cpu_generation", "gpu", "ram", "storage", "storage_type",
      "motherboard", "power_supply", "display_size", "ports", "operating_system",
      "bulk_price", "minimum_bulk_quantity", "wholesale_price", "vendor_sku", "supplier"
    ]

    const fields: string[] = []
    const placeholders: string[] = []
    const values: any[] = []
    let pi = 1

    // Default values
    const finalData = {
      status: 'draft',
      is_featured: false,
      is_digital: false,
      is_giftcard: false,
      metadata: {},
      tags: [],
      ...data
    }

    // Auto-generate slug if not provided
    if (!finalData.slug && !finalData.handle) {
      finalData.slug = finalData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now()
    } else if (finalData.handle && !finalData.slug) {
      finalData.slug = finalData.handle
    }

    if (finalData.slug) allowedFields.push("slug")

    for (const [key, value] of Object.entries(finalData)) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase()
      if (allowedFields.includes(snakeKey)) {
        fields.push(snakeKey)
        placeholders.push(`$${pi++}`)
        values.push(value)
      }
    }

    const result = await db.query(
      `INSERT INTO products (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    )
    const product = result.rows[0]

    // Automatically create a default variant if not already part of complex data
    // (Medusa standard: every product needs at least one variant)
    await this.createVariant(product.id, {
      title: 'Default Variant',
      sku: data.sku || `SKU-${product.id}`,
      price: data.price || 0,
      stock_quantity: data.stock_quantity || data.stockQuantity || 0,
      ...data
    })

    return product
  }

  /**
   * Update product with Enterprise field support
   */
  static async updateProduct(id: string, data: any) {
    const allowedFields = [
      "name", "handle", "subtitle", "description", "short_description", "material", "origin_country",
      "hs_code", "mid_code", "weight_grams", "length_mm", "height_mm", "width_mm", 
      "status", "metadata", "category_id", "collection_id", "vendor_id", "is_featured", "is_digital",
      "price", "compare_at_price", "cost_price", "stock_quantity", "low_stock_threshold",
      "tags", "sku", "attributes",
      // Hardware Fields
      "brand", "model", "warranty", "condition",
      "processor", "cpu_generation", "gpu", "ram", "storage", "storage_type",
      "motherboard", "power_supply", "display_size", "ports", "operating_system",
      "bulk_price", "minimum_bulk_quantity", "wholesale_price", "vendor_sku", "supplier"
    ]
    
    const updates: string[] = []
    const values: any[] = [id]
    let pi = 2

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase()
      if (allowedFields.includes(snakeKey)) {
        updates.push(`${snakeKey} = $${pi++}`)
        values.push(value)
      }
    }


    if (updates.length === 0) return null

    const result = await db.query(
      `UPDATE products SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    )
    const product = result.rows[0]

    // If global stock was updated, sync with default variant if one exists
    if (data.stock_quantity !== undefined || data.stockQuantity !== undefined) {
      const stock = data.stock_quantity ?? data.stockQuantity;
      await db.query(
        "UPDATE product_variants SET stock_quantity = $1 WHERE product_id = $2 AND title = 'Default Variant'",
        [stock, id]
      )
    }

    return product
  }

  /**
   * Create variant with automatic inventory item
   */
  static async createVariant(productId: string, data: any) {
    const allowedFields = [
      "title", "sku", "price", "stock_quantity", "attributes", "thumbnail_url", "metadata", "is_active"
    ]
    
    const fields: string[] = ["product_id"]
    const placeholders: string[] = ["$1"]
    const values: any[] = [productId]
    let pi = 2

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase()
      if (allowedFields.includes(snakeKey)) {
        fields.push(snakeKey)
        placeholders.push(`$${pi++}`)
        values.push(value)
      }
    }

    const result = await db.query(
      `INSERT INTO product_variants (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    )
    const variant = result.rows[0]

    // Automatically create inventory item for this variant
    await InventoryService.createInventoryItem(variant.id, {
      ...data,
      sku: variant.sku,
    })

    return variant
  }

  /**
   * Update variant
   */
  static async updateVariant(variantId: string, data: any) {
    const allowedFields = [
      "title", "sku", "price", "stock_quantity", "attributes", "thumbnail_url", "metadata", "is_active"
    ]
    
    const updates: string[] = []
    const values: any[] = [variantId]
    let pi = 2

    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase()
      if (allowedFields.includes(snakeKey)) {
        updates.push(`${snakeKey} = $${pi++}`)
        values.push(value)
      }
    }

    if (updates.length === 0) return null

    const result = await db.query(
      `UPDATE product_variants SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      values
    )
    return result.rows[0]
  }
}
