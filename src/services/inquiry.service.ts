import { db } from "../db"

export class InquiryService {
  /**
   * Create a new bulk inquiry
   */
  static async createInquiry(data: any) {
    const {
      customerId, customerName, companyName, email, phone,
      productId, variantId, requestedQuantity, message, budgetRange
    } = data

    // Get vendor ID for the product
    const productResult = await db.query("SELECT vendor_id FROM products WHERE id = $1", [productId])
    if (!productResult.rows[0]) throw new Error("Product not found")
    const vendorId = productResult.rows[0].vendor_id

    const result = await db.query(
      `INSERT INTO bulk_inquiries (
        customer_id, customer_name, company_name, email, phone,
        product_id, variant_id, requested_quantity, message, budget_range,
        vendor_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
      RETURNING *`,
      [
        customerId || null, customerName, companyName || null, email, phone || null,
        productId, variantId || null, requestedQuantity, message || null, budgetRange || null,
        vendorId
      ]
    )

    return result.rows[0]
  }

  /**
   * List inquiries for a vendor
   */
  static async listForVendor(vendorId: string) {
    const result = await db.query(
      `SELECT i.*, p.name as product_name, p.slug as product_slug, v.title as variant_title
       FROM bulk_inquiries i
       JOIN products p ON i.product_id = p.id
       LEFT JOIN product_variants v ON i.variant_id = v.id
       WHERE i.vendor_id = $1
       ORDER BY i.created_at DESC`,
      [vendorId]
    )
    return result.rows[0] ? result.rows : []
  }

  /**
   * List all inquiries (Admin)
   */
  static async listAll() {
    const result = await db.query(
      `SELECT i.*, p.name as product_name, p.slug as product_slug, v.title as variant_title, vnd.store_name
       FROM bulk_inquiries i
       JOIN products p ON i.product_id = p.id
       LEFT JOIN product_variants v ON i.variant_id = v.id
       JOIN vendors vnd ON i.vendor_id = vnd.id
       ORDER BY i.created_at DESC`
    )
    return result.rows
  }

  /**
   * Update inquiry status
   */
  static async updateStatus(id: string, status: string) {
    const result = await db.query(
      "UPDATE bulk_inquiries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, id]
    )
    return result.rows[0]
  }

  /**
   * Get inquiry by ID with details
   */
  static async getById(id: string) {
    const result = await db.query(
      `SELECT i.*, p.name as product_name, p.slug as product_slug, v.title as variant_title
       FROM bulk_inquiries i
       JOIN products p ON i.product_id = p.id
       LEFT JOIN product_variants v ON i.variant_id = v.id
       WHERE i.id = $1`,
      [id]
    )
    return result.rows[0]
  }
}
