import { Router } from "express"
import { createRazorpayOrder, verifyPayment, razorpayWebhook } from "../controllers/payment.controller"
import { authenticate } from "../middleware/auth"

export const paymentRouter = Router()

paymentRouter.post("/create-order", authenticate, createRazorpayOrder)
paymentRouter.post("/verify", authenticate, verifyPayment)
paymentRouter.post("/webhook/razorpay", razorpayWebhook)
