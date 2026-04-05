import { db } from "../db"

export class CustomerGroupService {
  /**
   * Create a customer group
   */
  static async createGroup(name: string, metadata: any = {}) {
    const result = await db.query(
      "INSERT INTO customer_groups (name, metadata) VALUES ($1, $2) RETURNING *",
      [name, metadata]
    )
    return result.rows[0]
  }

  /**
   * List all customer groups
   */
  static async listGroups(params: { limit?: number; offset?: number; q?: string } = {}) {
    const { limit = 20, offset = 0, q } = params
    const conditions: string[] = []
    const args: any[] = [limit, offset]
    let pi = 3

    if (q) {
      conditions.push(`name ILIKE $${pi++}`)
      args.push(`%${q}%`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
    const result = await db.query(
      `SELECT cg.*, 
        (SELECT COUNT(*) FROM customer_group_customers cgc WHERE cgc.customer_group_id = cg.id) as customer_count 
       FROM customer_groups cg
       ${where}
       ORDER BY cg.name ASC
       LIMIT $1 OFFSET $2`,
      args
    )
    return result.rows
  }

  /**
   * Assign customer to a group
   */
  static async assignCustomer(customerId: string, groupId: string) {
    const result = await db.query(
      "INSERT INTO customer_group_customers (customer_id, customer_group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *",
      [customerId, groupId]
    )
    return result.rows[0]
  }

  /**
   * Get groups for a customer
   */
  static async getCustomerGroups(customerId: string) {
    const result = await db.query(
      `SELECT cg.* FROM customer_groups cg
       JOIN customer_group_customers cgc ON cg.id = cgc.customer_group_id
       WHERE cgc.customer_id = $1`,
      [customerId]
    )
    return result.rows
  }
}
