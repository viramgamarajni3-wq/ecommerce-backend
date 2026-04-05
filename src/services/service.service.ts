import { db } from "../db"

export class ServiceService {
  /**
   * List all active services
   */
  static async listServices() {
    const result = await db.query(
      "SELECT * FROM services WHERE status = 'active' ORDER BY name ASC"
    )
    return result.rows
  }

  /**
   * Create a new service request
   */
  static async createServiceRequest(data: any) {
    const {
      service_id, customer_name, phone, email,
      service_type, description, address
    } = data

    const result = await db.query(
      `INSERT INTO service_requests (
        service_id, customer_name, phone, email,
        service_type, description, address, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *`,
      [
        service_id || null, customer_name, phone, email,
        service_type, description || null, address || null
      ]
    )

    return result.rows[0]
  }

  /**
   * List all service requests (Admin)
   */
  static async listAllRequests() {
    const result = await db.query(
      `SELECT r.*, s.name as matched_service_name
       FROM service_requests r
       LEFT JOIN services s ON r.service_id = s.id
       ORDER BY r.created_at DESC`
    )
    return result.rows
  }

  /**
   * Update service request status
   */
  static async updateRequestStatus(id: string, status: string) {
    const result = await db.query(
      "UPDATE service_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, id]
    )
    return result.rows[0]
  }
}
