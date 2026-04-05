import { Router } from "express"
import { authenticate, authorize, optionalAuth } from "../middleware/auth"
import { InquiryService } from "../services/inquiry.service"
import { db } from "../db"
import { AppError } from "../utils/AppError"

export const inquiriesRouter = Router()

// ─── POST / (Customer/Public) ─────────────────────────────────
inquiriesRouter.post("/", optionalAuth, async (req, res, next) => {
  try {
    const customerId = (req as any).user?.userId
    const inquiry = await InquiryService.createInquiry({
      ...req.body,
      customerId
    })
    res.status(201).json({ success: true, data: inquiry })
  } catch (err) { next(err) }
})

// ─── GET /vendor (Vendors) ────────────────────────────────────
inquiriesRouter.get("/vendor", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    if (!vendorResult.rows[0]) throw new AppError("Vendor not found", 404)

    const inquiries = await InquiryService.listForVendor(vendorResult.rows[0].id)
    res.json({ success: true, data: inquiries })
  } catch (err) { next(err) }
})

// ─── GET /vendor/:id (Vendor Details) ─────────────────────────
inquiriesRouter.get("/vendor/:id", authenticate, authorize("vendor"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId
    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    if (!vendorResult.rows[0]) throw new AppError("Vendor not found", 404)

    const inquiry = await InquiryService.getById(req.params.id)
    if (!inquiry || inquiry.vendor_id !== vendorResult.rows[0].id) {
       throw new AppError("Access denied", 403)
    }

    res.json({ success: true, data: inquiry })
  } catch (err) { next(err) }
})

// ─── GET /admin (Admin All) ───────────────────────────────────
inquiriesRouter.get("/admin", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const inquiries = await InquiryService.listAll()
    res.json({ success: true, data: inquiries })
  } catch (err) { next(err) }
})

// ─── PATCH /:id/status (Inquiry Response/Status) ─────────────
inquiriesRouter.patch("/:id/status", authenticate, authorize("vendor", "admin"), async (req, res, next) => {
  try {
    const { status } = req.body
    const inquiry = await InquiryService.updateStatus(req.params.id, status)
    res.json({ success: true, data: inquiry })
  } catch (err) { next(err) }
})
