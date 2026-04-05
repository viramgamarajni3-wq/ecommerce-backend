import { Router } from "express"
import { ServiceService } from "../services/service.service"
import { authenticate, authorize, optionalAuth } from "../middleware/auth"

export const servicesRouter = Router()

// ─── GET / (Public) ───────────────────────────────────────────
servicesRouter.get("/", async (req, res, next) => {
  try {
    const services = await ServiceService.listServices()
    res.json({ success: true, data: services })
  } catch (err) { next(err) }
})

// ─── POST /request (Customer/Public) ───────────────────────────
servicesRouter.post("/request", async (req, res, next) => {
  try {
    const request = await ServiceService.createServiceRequest(req.body)
    res.status(201).json({ success: true, data: request })
  } catch (err) { next(err) }
})

// ─── GET /admin/requests (Admin Only) ──────────────────────────
servicesRouter.get("/admin/requests", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const requests = await ServiceService.listAllRequests()
    res.json({ success: true, data: requests })
  } catch (err) { next(err) }
})

// ─── PATCH /admin/requests/:id/status (Admin Only) ──────────────
servicesRouter.patch("/admin/requests/:id/status", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { status } = req.body
    const request = await ServiceService.updateRequestStatus(req.params.id, status)
    res.json({ success: true, data: request })
  } catch (err) { next(err) }
})
