import { db } from "../db"

export class DiscountService {
  /**
   * Create discount with conditions (Category, Product, Customer Group)
   */
  static async createDiscount(data: any) {
    const { code, type, value, ends_at, vendor_id, metadata, conditions = [] } = data

    // 1. Create discount rule
    const res = await db.query(
      `INSERT INTO discounts (code, type, value, ends_at, vendor_id, is_active, metadata)
       VALUES ($1,$2,$3,$4,$5, true, $6) RETURNING *`,
      [code.toUpperCase(), type || 'percentage', value, ends_at || null, vendor_id || null, metadata || {}]
    )
    const discount = res.rows[0]

    // 2. Add conditions if present
    for (const condition of conditions) {
      const { type, operator = 'in', val_ids = [] } = condition
      const condResult = await db.query(
        "INSERT INTO discount_conditions (type, discount_rule_id, operator) VALUES ($1,$2,$3) RETURNING id",
        [type, discount.id, operator]
      )

      // Link condition to specific IDs (depending on type)
      // This part would need junction tables for products/categories etc.
      // For now, simplify into the controller or metadata.
    }
    return discount
  }

  /**
   * List all discounts with conditions summary
   */
  static async listDiscounts() {
    const result = await db.query(
      `SELECT d.*, 
        (SELECT JSON_AGG(dc) FROM discount_conditions dc WHERE dc.discount_rule_id = d.id) as conditions
       FROM discounts d
       ORDER BY d.created_at DESC`
    )
    return result.rows
  }

  /**
   * Check if a discount code applies to a cart or customer
   */
  static async validateDiscount(code: string, cartInfo: any) {
    const result = await db.query(
      "SELECT * FROM discounts WHERE code = $1 AND is_active = TRUE AND (ends_at > NOW() OR ends_at IS NULL)",
      [code.toUpperCase()]
    )
    const discount = result.rows[0]
    if (!discount) return { valid: false, message: "Invalid or expired code" }

    // More complex condition checking would happen here
    return { valid: true, discount }
  }
}
