import { Request, Response, NextFunction } from "express"
import Razorpay from "razorpay"
import crypto from "crypto"
import { db } from "../db"
import { AppError } from "../utils/AppError"
import { logger } from "../utils/logger"

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_dummy",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret",
})




// ─── POST /payment/create-order ──────────────────────────────
// Called when user is on checkout page
export async function createRazorpayOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const { cartId, addressId, couponCode } = req.body

    if (!cartId || !addressId) throw new AppError("cartId and addressId are required", 400)

    // 1. Fetch cart items with product details
    const cartResult = await db.query(
      `SELECT ci.id, ci.quantity, ci.unit_price,
        p.id as product_id, p.name, p.stock_quantity, p.vendor_id,
        v.commission_rate
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       JOIN vendors v ON p.vendor_id = v.id
       JOIN carts c ON ci.cart_id = c.id
       WHERE ci.cart_id = $1 AND c.user_id = $2 AND p.status = 'active'`,
      [cartId, userId]
    )

    if (cartResult.rows.length === 0) throw new AppError("Cart is empty or not found", 400)

    // 2. Validate stock
    for (const item of cartResult.rows) {
      if (item.stock_quantity < item.quantity) {
        throw new AppError(`Insufficient stock for product: ${item.name}`, 400)
      }
    }

    // 3. Fetch address
    const addressResult = await db.query(
      "SELECT * FROM addresses WHERE id = $1 AND user_id = $2",
      [addressId, userId]
    )
    if (!addressResult.rows[0]) throw new AppError("Address not found", 404)
    const address = addressResult.rows[0]

    // 4. Calculate totals
    let subtotal = cartResult.rows.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
    let discountAmount = 0

    if (couponCode) {
      const couponResult = await db.query(
        `SELECT * FROM coupons
         WHERE code = $1 AND is_active = TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (usage_limit IS NULL OR used_count < usage_limit)
           AND min_order_value <= $2`,
        [couponCode.toUpperCase(), subtotal]
      )
      if (couponResult.rows[0]) {
        const coupon = couponResult.rows[0]
        if (coupon.discount_type === "percentage") {
          discountAmount = (subtotal * coupon.discount_value) / 100
          if (coupon.max_discount) discountAmount = Math.min(discountAmount, coupon.max_discount)
        } else {
          discountAmount = coupon.discount_value
        }
      }
    }

    const shippingAmount = subtotal >= 500 ? 0 : 49  // Free shipping above ₹500
    const taxRate = 0.18  // 18% GST
    const taxAmount = Math.round((subtotal - discountAmount) * taxRate * 100) / 100
    const total = subtotal - discountAmount + shippingAmount + taxAmount

    // 5. Create Razorpay order
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(total * 100),  // in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { userId, cartId },
    })

    // 6. Create order record in DB
    const orderResult = await db.query(
      `INSERT INTO orders (
        order_number, user_id, status, payment_status,
        subtotal, discount_amount, shipping_amount, tax_amount, total,
        razorpay_order_id, shipping_address
       ) VALUES (
        generate_order_number(), $1, 'pending', 'pending',
        $2, $3, $4, $5, $6, $7, $8
       ) RETURNING id, order_number`,
      [
        userId, subtotal, discountAmount, shippingAmount, taxAmount, total,
        rzpOrder.id,
        JSON.stringify({
          firstName: address.first_name, lastName: address.last_name,
          addressLine1: address.address_line1, addressLine2: address.address_line2,
          city: address.city, state: address.state,
          postalCode: address.postal_code, country: address.country,
          phone: address.phone,
        }),
      ]
    )

    const orderId = orderResult.rows[0].id
    const orderNumber = orderResult.rows[0].order_number

    // 7. Insert order items
    for (const item of cartResult.rows) {
      const commission = (item.unit_price * item.quantity) * (item.commission_rate / 100)
      const vendorAmount = (item.unit_price * item.quantity) - commission

      await db.query(
        `INSERT INTO order_items (
          order_id, product_id, vendor_id, product_name, quantity,
          unit_price, total_price, vendor_amount, commission
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          orderId, item.product_id, item.vendor_id, item.name,
          item.quantity, item.unit_price,
          item.unit_price * item.quantity,
          vendorAmount, commission,
        ]
      )
    }

    res.json({
      success: true,
      data: {
        orderId,
        orderNumber,
        razorpayOrderId: rzpOrder.id,
        amount: total,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /payment/verify ────────────────────────────────────
export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, orderId } = req.body

    // 1. Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex")

    if (expectedSignature !== razorpaySignature) {
      throw new AppError("Payment verification failed - invalid signature", 400)
    }

    // 2. Update order status
    await db.query(
      `UPDATE orders SET
        payment_status = 'paid',
        status = 'confirmed',
        razorpay_payment_id = $1,
        razorpay_signature = $2
       WHERE id = $3 AND razorpay_order_id = $4`,
      [razorpayPaymentId, razorpaySignature, orderId, razorpayOrderId]
    )

    // 3. Update product stock and sales
    const itemsResult = await db.query(
      "SELECT product_id, quantity, vendor_id, vendor_amount, commission FROM order_items WHERE order_id = $1",
      [orderId]
    )

    for (const item of itemsResult.rows) {
      await db.query(
        "UPDATE products SET stock_quantity = stock_quantity - $1, total_sold = total_sold + $1 WHERE id = $2",
        [item.quantity, item.product_id]
      )

      // Create payout record for vendor
      await db.query(
        `INSERT INTO vendor_payouts (vendor_id, order_id, amount, commission, net_amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [item.vendor_id, orderId, item.vendor_amount + item.commission, item.commission, item.vendor_amount]
      )

      // Update vendor stats
      await db.query(
        `UPDATE vendors SET
          total_sales = total_sales + $1,
          total_orders = total_orders + 1
         WHERE id = $2`,
        [item.vendor_amount, item.vendor_id]
      )
    }

    logger.info(`✅ Payment verified for order ${orderId}`)

    res.json({
      success: true,
      message: "Payment verified successfully",
      data: { orderId },
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /webhooks/razorpay ─────────────────────────────────
export async function razorpayWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"] as string
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!
    const body = req.body as Buffer

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex")

    if (webhookSignature !== expectedSignature) {
      logger.warn("❌ Invalid Razorpay webhook signature")
      return res.status(400).json({ error: "Invalid signature" })
    }

    const event = JSON.parse(body.toString())
    logger.info(`📩 Razorpay webhook event: ${event.event}`)

    switch (event.event) {
      case "payment.captured":
        // Handled via verify endpoint
        break
      case "payment.failed":
        const failedPaymentId = event.payload.payment.entity.notes?.orderId
        if (failedPaymentId) {
          await db.query(
            "UPDATE orders SET payment_status = 'failed' WHERE id = $1",
            [failedPaymentId]
          )
        }
        break
      case "refund.created":
        // Handle refund
        break
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
}
