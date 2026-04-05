import { db } from "../db"

export class InventoryService {
  /**
   * Create an inventory item for a variant
   */
  static async createInventoryItem(variantId: string, data: any) {
    const allowedFields = [
      "sku", "origin_country", "hs_code", "mid_code", "material", 
      "weight", "length", "height", "width", "requires_shipping", "metadata"
    ]

    const fields: string[] = ["created_at", "updated_at"]
    const placeholders: string[] = ["NOW()", "NOW()"]
    const values: any[] = []
    let pi = 1

    const finalData = { ...data }
    
    // Map dimensions if passed with products-style names
    if (finalData.weight_grams !== undefined) finalData.weight = finalData.weight_grams
    if (finalData.length_mm !== undefined) finalData.length = finalData.length_mm
    if (finalData.height_mm !== undefined) finalData.height = finalData.height_mm
    if (finalData.width_mm !== undefined) finalData.width = finalData.width_mm

    for (const [key, value] of Object.entries(finalData)) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase()
      if (allowedFields.includes(snakeKey)) {
        fields.push(snakeKey)
        placeholders.push(`$${pi++}`)
        values.push(value)
      }
    }

    const invResult = await db.query(
      `INSERT INTO inventory_items (${fields.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
      values
    )
    const inventoryItemId = invResult.rows[0].id

    // 2. Link to variant
    await db.query(
      "INSERT INTO product_variant_inventory_items (variant_id, inventory_item_id) VALUES ($1, $2)",
      [variantId, inventoryItemId]
    )
    return invResult.rows[0]
  }

  /**
   * Adjust stock (Enterprise Reservation/Release logic)
   */
  static async adjustStock(variantId: string, delta: number) {
    // Basic implementation for now: update stock_quantity on variant
    const result = await db.query(
      "UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2 RETURNING *",
      [delta, variantId]
    )
    return result.rows[0]
  }

  /**
   * Get variant inventory summary
   */
  static async getVariantInventory(variantId: string) {
    const result = await db.query(
      `SELECT ii.*, pvii.required_quantity
       FROM inventory_items ii
       JOIN product_variant_inventory_items pvii ON ii.id = pvii.inventory_item_id
       WHERE pvii.variant_id = $1`,
      [variantId]
    )
    return result.rows
  }
}
