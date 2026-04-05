import { Router } from "express"
import { db } from "../db"
import { AppError } from "../utils/AppError"
import { optionalAuth } from "../middleware/auth"

export const storeRouter = Router()

// ─── Products Compatibility ─────────────────────────────────
storeRouter.get("/products", async (req, res, next) => {
  try {
    const { handle, category_id, collection_id, limit = 20, offset = 0, q } = req.query
    const params: any[] = [Number(limit), Number(offset)]
    const conditions = ["p.status = 'active'"]
    let pi = 3

    if (handle) { conditions.push(`p.slug = $${pi++}`); params.push(handle) }
    if (category_id) { conditions.push(`p.category_id = $${pi++}`); params.push(category_id) }
    if (collection_id) { conditions.push(`p.collection_id = $${pi++}`); params.push(collection_id) }
    if (q) { conditions.push(`p.name ILIKE $${pi++}`); params.push(`%${q}%`) }

    const productsResult = await db.query(
      `SELECT p.id, p.name, p.slug, p.description, p.price, p.stock_quantity, p.sku,
        (SELECT JSON_AGG(v ORDER BY v.created_at) FROM product_variants v WHERE v.product_id = p.id) as variants,
        (SELECT JSON_AGG(i ORDER BY i.sort_order) FROM product_images i WHERE i.product_id = p.id) as images,
        (SELECT JSON_AGG(o ORDER BY o.created_at) FROM product_options o WHERE o.product_id = p.id) as options,
        v.store_name as vendor_name
       FROM products p 
       LEFT JOIN vendors v ON p.vendor_id = v.id
       WHERE ${conditions.join(" AND ")} 
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    )

    // Fix: Use correct parameters for count query (ignore limit/offset)
    const countConditions = ["status = 'active'"]
    const countParams: any[] = []
    let cpi = 1
    if (handle) { countConditions.push(`slug = $${cpi++}`); countParams.push(handle) }
    if (category_id) { countConditions.push(`category_id = $${cpi++}`); countParams.push(category_id) }
    if (collection_id) { countConditions.push(`collection_id = $${cpi++}`); countParams.push(collection_id) }
    if (q) { countConditions.push(`name ILIKE $${cpi++}`); countParams.push(`%${q}%`) }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM products WHERE ${countConditions.join(" AND ")}`, 
      countParams
    )

    const products = productsResult.rows.map(p => {
      const rawVariants = p.variants || []
      const displayVariants = rawVariants.length > 0 ? rawVariants : [{
        id: `DEFAULT-${p.id}`,
        title: 'Standard',
        sku: p.sku || `SKU-${p.id}`,
        price: p.price,
        stock_quantity: p.stock_quantity
      }]

      return {
        ...p,
        title: p.name,
        handle: p.slug,
        thumbnail: p.images?.[0]?.url || null,
        // FIX: Proper Medusa inventory flow for storefront
        inventory_quantity: p.stock_quantity,
        manage_inventory: true,
        allow_backorder: false,
        variants: displayVariants.map((v: any) => ({
          ...v,
          title: v.title || v.name || 'Standard',
          inventory_quantity: v.stock_quantity || 0, // CRITICAL FIX: Medusa frontend checks this!
          manage_inventory: true,
          allow_backorder: false,
          prices: [{ 
            amount: Number(v.price) * 100, 
            currency_code: 'inr' 
          }],
          options: (p.options || []).map((o: any) => ({
            id: o.id,
            title: o.title,
            value: (v.attributes || {})[o.title.toLowerCase()] || 'Default'
          }))
        })),
        options: (p.options || []).map((o: any) => {
          const values = [...new Set(displayVariants.map((v: any) => (v.attributes || {})[o.title.toLowerCase()]))]
            .filter(Boolean)
            .map((v, idx) => ({ id: `${o.id}-v-${idx}`, value: v }))
          return {
            id: o.id,
            title: o.title,
            values: values
          }
        })
      }
    })

    res.json({
      products,
      count: parseInt(countResult.rows[0].count),
      offset: Number(offset),
      limit: Number(limit)
    })
  } catch (err) { next(err) }
})

// GET /store/products/:id (also handles handle)
storeRouter.get("/products/:id", async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.*, 
        (SELECT JSON_AGG(v ORDER BY v.created_at) FROM product_variants v WHERE v.product_id = p.id) as variants,
        (SELECT JSON_AGG(i ORDER BY i.sort_order) FROM product_images i WHERE i.product_id = p.id) as images,
        (SELECT JSON_AGG(o ORDER BY o.created_at) FROM product_options o WHERE o.product_id = p.id) as options
       FROM products p WHERE p.id::text = $1 OR p.slug = $1`,
      [req.params.id]
    )
    if (!result.rows[0]) throw new AppError("Product not found", 404)
    
    const p = result.rows[0]
    const rawVariants = p.variants || []
    const displayVariants = rawVariants.length > 0 ? rawVariants : [{
      id: `DEFAULT-${p.id}`,
      title: 'Standard',
      sku: p.sku || `SKU-${p.id}`,
      price: p.price,
      stock_quantity: p.stock_quantity
    }]

    res.json({ product: { 
      ...p, 
      title: p.name,
      handle: p.slug,
      thumbnail: p.images?.[0]?.url || null,
      inventory_quantity: p.stock_quantity,
      manage_inventory: true,
      variants: displayVariants.map((v: any) => ({
        ...v,
        inventory_quantity: v.stock_quantity || 0,
        manage_inventory: true,
        allow_backorder: false,
        prices: [{ amount: Number(v.price) * 100, currency_code: 'inr' }],
        options: (p.options || []).map((o: any) => ({
          id: o.id,
          title: o.title,
          option_id: o.id,
          value: (v.attributes || {})[o.title.toLowerCase()] || 'Default'
        }))
      })),
      options: (p.options || []).map((o: any) => {
        const values = [...new Set(displayVariants.map((v: any) => (v.attributes || {})[o.title.toLowerCase()]))]
          .filter(Boolean)
          .map((v, idx) => ({ id: `${o.id}-v-${idx}`, value: v }))
        return {
          id: o.id,
          title: o.title,
          values: values
        }
      })
    }})
  } catch (err) { next(err) }
})

// ─── Collections, Categories, Regions ─────────────────────
storeRouter.get("/collections", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM collections ORDER BY title ASC")
    res.json({ 
      collections: result.rows.map(c => ({
        ...c,
        handle: c.handle || c.id
      })) 
    })
  } catch (err) { next(err) }
})

storeRouter.get("/product-categories", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM categories ORDER BY name ASC")
    res.json({ 
      product_categories: result.rows.map(c => ({ 
        ...c, 
        handle: c.slug, 
        category_children: []
      })) 
    })
  } catch (err) { next(err) }
})

storeRouter.get("/regions", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM regions")
    res.json({ regions: result.rows })
  } catch (err) { next(err) }
})

// ─── Carts (Basic Flow) ────────────────────────────────────
storeRouter.post("/carts", optionalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user
    const sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    let result;
    if (user && user.userId) {
      result = await db.query(
        "INSERT INTO carts (currency, session_id, user_id) VALUES ('INR', $1, $2) RETURNING *", 
        [sessionId, user.userId]
      )
    } else {
      result = await db.query(
        "INSERT INTO carts (currency, session_id) VALUES ('INR', $1) RETURNING *", 
        [sessionId]
      )
    }
    
    res.status(201).json({ cart: { ...result.rows[0], items: [] } })
  } catch (err) { next(err) }
})

storeRouter.get("/carts/:id", optionalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user
    if (user && user.userId) {
      // Sync cart with user if not already set
      await db.query("UPDATE carts SET user_id = $1 WHERE id = $2 AND user_id IS NULL", [user.userId, req.params.id])
    }

    const result = await db.query(
      `SELECT c.*, 
        (SELECT JSON_AGG(
          jsonb_build_object(
            'id', ci.id,
            'cart_id', ci.cart_id,
            'variant_id', ci.variant_id,
            'quantity', ci.quantity,
            'unit_price', ci.unit_price,
            'thumbnail', (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC LIMIT 1),
            'title', p.name,
            'variant', jsonb_build_object('id', pv.id, 'title', pv.title)
          )
        ) FROM cart_items ci
          LEFT JOIN product_variants pv ON ci.variant_id = pv.id
          LEFT JOIN products p ON ci.product_id = p.id
          WHERE ci.cart_id = c.id
        ) as items
       FROM carts c WHERE c.id = $1`,
      [req.params.id]
    )
    if (!result.rows[0]) throw new AppError("Cart not found", 404)
    
    const cart = result.rows[0]
    if (cart.items === null) cart.items = []
    res.json({ cart })
  } catch (err) { next(err) }
})

storeRouter.post("/carts/:id", optionalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user
    const { email, shipping_address, billing_address } = req.body
    let userId = user?.userId

    // Update cart with email and address if provided
    if (email || shipping_address || billing_address) {
      const updates: string[] = []
      const values: any[] = []
      let pi = 1
      
      if (email) { updates.push(`email = $${pi++}`); values.push(email) }
      if (shipping_address) { updates.push(`shipping_address = $${pi++}`); values.push(JSON.stringify(shipping_address)) }
      if (billing_address) { updates.push(`billing_address = $${pi++}`); values.push(JSON.stringify(billing_address)) }
      
      if (userId) { updates.push(`user_id = $${pi++}`); values.push(userId) }
      
      values.push(req.params.id)
      await db.query(`UPDATE carts SET ${updates.join(", ")} WHERE id = $${pi}`, values)
    } else if (userId) {
       await db.query("UPDATE carts SET user_id = $1 WHERE id = $2 AND user_id IS NULL", [userId, req.params.id])
    }
    
    // Fetch updated cart
    const cartResult = await db.query(
      `SELECT c.*, 
        (SELECT JSON_AGG(
          jsonb_build_object(
            'id', ci.id,
            'cart_id', ci.cart_id,
            'variant_id', ci.variant_id,
            'quantity', ci.quantity,
            'unit_price', ci.unit_price,
            'thumbnail', (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC LIMIT 1),
            'title', p.name,
            'variant', jsonb_build_object('id', pv.id, 'title', pv.title)
          )
        ) FROM cart_items ci
          LEFT JOIN product_variants pv ON ci.variant_id = pv.id
          LEFT JOIN products p ON ci.product_id = p.id
          WHERE ci.cart_id = c.id
        ) as items
       FROM carts c WHERE c.id = $1`,
      [req.params.id]
    )
    if (!cartResult.rows[0]) throw new AppError("Cart not found", 404)
    
    const cart = cartResult.rows[0]
    if (cart.items === null) cart.items = []
    res.json({ cart })
  } catch (err) { next(err) }
})

storeRouter.post("/carts/:id/line-items", async (req, res, next) => {
  try {
    const { variant_id: incoming_vid, quantity } = req.body
    
    let product_id: string;
    let price: number;
    let variant_id: string | null = incoming_vid;

    if (incoming_vid && incoming_vid.startsWith('DEFAULT-')) {
      product_id = incoming_vid.replace('DEFAULT-', '');
      variant_id = null;
      
      const pResult = await db.query("SELECT price FROM products WHERE id = $1", [product_id]);
      if (!pResult.rows[0]) throw new AppError("Product not found", 404);
      price = pResult.rows[0].price;
    } else {
      const vResult = await db.query("SELECT product_id, price FROM product_variants WHERE id = $1", [variant_id]);
      if (!vResult.rows[0]) throw new AppError("Variant not found", 404);
      product_id = vResult.rows[0].product_id;
      price = vResult.rows[0].price;
    }

    // Insert or update cart_items manually to bypass ON CONFLICT NULL issues
    let existingItem;
    if (variant_id) {
      existingItem = await db.query("SELECT id FROM cart_items WHERE cart_id = $1 AND product_id = $2 AND variant_id = $3", [req.params.id, product_id, variant_id]);
    } else {
      existingItem = await db.query("SELECT id FROM cart_items WHERE cart_id = $1 AND product_id = $2 AND variant_id IS NULL", [req.params.id, product_id]);
    }

    if (existingItem.rows[0]) {
      await db.query("UPDATE cart_items SET quantity = quantity + $1 WHERE id = $2", [quantity, existingItem.rows[0].id]);
    } else {
      await db.query(
        `INSERT INTO cart_items (cart_id, product_id, variant_id, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, product_id, variant_id, quantity, price]
      );
    }
    
    // Fetch updated cart
    const cartResult = await db.query(
      `SELECT c.*, 
        (SELECT JSON_AGG(
          jsonb_build_object(
            'id', ci.id,
            'cart_id', ci.cart_id,
            'variant_id', ci.variant_id,
            'quantity', ci.quantity,
            'unit_price', ci.unit_price,
            'thumbnail', (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC LIMIT 1),
            'title', p.name,
            'variant', jsonb_build_object('id', pv.id, 'title', pv.title)
          )
        ) FROM cart_items ci
          LEFT JOIN product_variants pv ON ci.variant_id = pv.id
          LEFT JOIN products p ON ci.product_id = p.id
          WHERE ci.cart_id = c.id
        ) as items
       FROM carts c WHERE c.id = $1`,
      [req.params.id]
    )
    const cart = cartResult.rows[0]
    if (cart.items === null) cart.items = []
    res.status(201).json({ cart })
  } catch (err) { next(err) }
})

storeRouter.post("/carts/:id/line-items/:line_id", async (req, res, next) => {
  try {
    const { quantity } = req.body
    await db.query("UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id = $3", [quantity, req.params.line_id, req.params.id])
    
    // Fetch updated cart
    const cartResult = await db.query(
      `SELECT c.*, 
        (SELECT JSON_AGG(
          jsonb_build_object(
            'id', ci.id,
            'cart_id', ci.cart_id,
            'variant_id', ci.variant_id,
            'quantity', ci.quantity,
            'unit_price', ci.unit_price,
            'thumbnail', (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC LIMIT 1),
            'title', p.name,
            'variant', jsonb_build_object('id', pv.id, 'title', pv.title)
          )
        ) FROM cart_items ci
          LEFT JOIN product_variants pv ON ci.variant_id = pv.id
          LEFT JOIN products p ON ci.product_id = p.id
          WHERE ci.cart_id = c.id
        ) as items
       FROM carts c WHERE c.id = $1`,
      [req.params.id]
    )
    const cart = cartResult.rows[0]
    if (cart.items === null) cart.items = []
    res.json({ cart })
  } catch (err) { next(err) }
})

storeRouter.delete("/carts/:id/line-items/:line_id", async (req, res, next) => {
  try {
    await db.query("DELETE FROM cart_items WHERE id = $1 AND cart_id = $2", [req.params.line_id, req.params.id])
    
    // Fetch updated cart
    const cartResult = await db.query(
      `SELECT c.*, 
        (SELECT JSON_AGG(
          jsonb_build_object(
            'id', ci.id,
            'cart_id', ci.cart_id,
            'variant_id', ci.variant_id,
            'quantity', ci.quantity,
            'unit_price', ci.unit_price,
            'thumbnail', (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY sort_order ASC LIMIT 1),
            'title', p.name,
            'variant', jsonb_build_object('id', pv.id, 'title', pv.title)
          )
        ) FROM cart_items ci
          LEFT JOIN product_variants pv ON ci.variant_id = pv.id
          LEFT JOIN products p ON ci.product_id = p.id
          WHERE ci.cart_id = c.id
        ) as items
       FROM carts c WHERE c.id = $1`,
      [req.params.id]
    )
    const cart = cartResult.rows[0]
    if (cart.items === null) cart.items = []
    res.json({ cart })
  } catch (err) { next(err) }
})

// ─── Shipping Options ──────────────────────────────────────
storeRouter.get("/shipping-options/:cartId", async (req, res, next) => {
  try {
    const { cartId } = req.params
    
    // In a real Medusa setup, these are fetched based on cart region/items
    // Since we're using a custom backend, return meaningful default options for India
    const defaultShippingOptions = [
      {
        id: "so_standard",
        name: "Standard Delivery",
        amount: 8000, // 80.00 INR (amount is in cents)
        price_type: "flat_rate",
        data: {},
        price_incl_tax: 8000,
        tax_amount: 0,
        metadata: {
          delivery_time: "3-5 business days"
        }
      },
      {
        id: "so_express",
        name: "Express Delivery",
        amount: 25000, // 250.00 INR
        price_type: "flat_rate",
        data: {},
        price_incl_tax: 25000,
        tax_amount: 0,
        metadata: {
          delivery_time: "1-2 business days"
        }
      },
      {
        id: "so_free",
        name: "Free Shipping",
        amount: 0,
        price_type: "flat_rate",
        data: {},
        price_incl_tax: 0,
        tax_amount: 0,
        metadata: {
          delivery_time: "5-7 business days",
          condition: "Orders above ₹5,000"
        }
      }
    ]

    res.json({ shipping_options: defaultShippingOptions })
  } catch (err) { next(err) }
})

storeRouter.post("/carts/:id/shipping-methods", async (req, res, next) => {
  try {
    const { option_id } = req.body
    // Mock updating the cart with the selected shipping method
    const result = await db.query(
      `SELECT c.*, 
        (SELECT JSON_AGG(
          jsonb_build_object(
            'id', ci.id, 'cart_id', ci.cart_id, 'variant_id', ci.variant_id, 
            'quantity', ci.quantity, 'unit_price', ci.unit_price,
            'title', p.name
          )
        ) FROM cart_items ci
          LEFT JOIN products p ON ci.product_id = p.id
          WHERE ci.cart_id = c.id
        ) as items
       FROM carts c WHERE c.id = $1`,
      [req.params.id]
    )
    const cart = result.rows[0]
    if (cart.items === null) cart.items = []
    
    // In a real setup, we'd add the shipping method to the cart record
    res.json({ cart })
  } catch (err) { next(err) }
})

storeRouter.post("/carts/:id/payment-sessions", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM carts WHERE id = $1", [req.params.id])
    if (!result.rows[0]) throw new AppError("Cart not found", 404)
    
    // Return a mock manual payment session
    res.json({ 
      cart: { 
        ...result.rows[0], 
        payment_sessions: [{ id: "ps_manual", provider_id: "manual", data: {}, status: "pending" }],
        payment_session: { id: "ps_manual", provider_id: "manual", data: {}, status: "pending" }
      } 
    })
  } catch (err) { next(err) }
})

// Singular variant for setPaymentSession
storeRouter.post("/carts/:id/payment-session", async (req, res, next) => {
  try {
    const result = await db.query("SELECT * FROM carts WHERE id = $1", [req.params.id])
    if (!result.rows[0]) throw new AppError("Cart not found", 404)
    res.json({ 
      cart: { 
        ...result.rows[0], 
        payment_session: { id: "ps_manual", provider_id: "manual", data: {}, status: "pending" }
      } 
    })
  } catch (err) { next(err) }
})

storeRouter.post("/carts/:id/complete", optionalAuth, async (req, res, next) => {
  try {
    const cartId = req.params.id
    const user = (req as any).user
    
    // 1. Fetch current cart and its items to persist in order
    const cartResult = await db.query(
      `SELECT c.*, ci.id as line_item_id, ci.product_id, ci.variant_id, ci.quantity, ci.unit_price, 
              p.name as product_name, pv.title as variant_title
       FROM carts c
       LEFT JOIN cart_items ci ON ci.cart_id = c.id
       LEFT JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE c.id = $1`, [cartId]
    )
    
    if (cartResult.rows.length === 0) throw new AppError("Cart not found", 404)
    
    const cartData = cartResult.rows[0]
    // Filter out null items (if cart is empty)
    const items = cartResult.rows.filter(r => r.line_item_id !== null)

    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`
    const subtotal = items.reduce((acc, item) => acc + (Number(item.unit_price) * item.quantity), 0)
    const total = subtotal // For now, ignoring tax, etc.

    // 2. Determine effective user and data from cart
    let effectiveUserId = user?.userId || cartData.user_id
    const effectiveEmail = cartData.email || user?.email || "customer@example.com"
    const effectiveShippingAddress = cartData.shipping_address || {}
    
    console.log(`[CHECKOUT] Complete attempt for cart ${cartId}. User: ${effectiveUserId || 'guest'}, Email: ${effectiveEmail}`)

    const orderInsert = await db.query(
      `INSERT INTO orders (
        order_number, user_id, status, payment_status, subtotal, shipping_amount, total, 
        currency, shipping_address, email
      ) VALUES ($1, $2, 'pending', 'pending', $3, 0, $4, 'INR', $5, $6) RETURNING id`,
      [orderNumber, effectiveUserId || null, subtotal, total, JSON.stringify(effectiveShippingAddress), effectiveEmail]
    )
    const createdOrderId = orderInsert.rows[0].id
    console.log(`[CHECKOUT] Persisted order ${createdOrderId} for ${effectiveEmail}`)

    // 3. Move items to order_items
    for (const item of items) {
      await db.query(
        `INSERT INTO order_items (
          order_id, product_id, vendor_id, variant_id, product_name, variant_title, 
          quantity, unit_price, total_price, vendor_amount, commission
        ) VALUES ($1, $2, (SELECT vendor_id FROM products WHERE id = $2), $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          createdOrderId, item.product_id, item.variant_id, item.product_name, item.variant_title,
          item.quantity, item.unit_price, Number(item.unit_price) * item.quantity, 
          (Number(item.unit_price) * item.quantity) * 0.9, (Number(item.unit_price) * item.quantity) * 0.1
        ]
      )
    }
    
    // 4. Clear cart after successful order creation
    await db.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId])

    res.json({ 
      type: "order", 
      data: {
        id: createdOrderId,
        order_number: orderNumber,
        status: "pending",
        payment_status: "pending",
        fulfillment_status: "pending",
        items: items,
        total: total,
        subtotal: subtotal,
        currency_code: "inr",
        email: effectiveEmail,
        shipping_address: effectiveShippingAddress,
        created_at: new Date().toISOString()
      }
    })
  } catch (err) { 
    console.error("Cart complete error", err)
    next(err) 
  }
})

// GET /store/orders - List orders for current user
storeRouter.get("/orders", optionalAuth, async (req, res, next) => {
  try {
    const user = (req as any).user
    if (!user) {
      return res.json({ orders: [], count: 0, offset: 0, limit: 10 })
    }

    const { limit = 10, offset = 0 } = req.query
    const result = await db.query(
      `SELECT o.*, 
        (SELECT JSON_AGG(oi) FROM order_items oi WHERE oi.order_id = o.id) as items
       FROM orders o 
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [user.userId, limit, offset]
    )

    const countResult = await db.query("SELECT COUNT(*) FROM orders WHERE user_id = $1", [user.userId])

    res.json({ 
      orders: result.rows,
      count: parseInt(countResult.rows[0].count),
      offset: Number(offset),
      limit: Number(limit)
    })
  } catch (err) { next(err) }
})

storeRouter.get("/orders/:id", async (req, res, next) => {
  try {
    // Check real orders first
    const result = await db.query(
      `SELECT o.*, 
        (SELECT JSON_AGG(oi) FROM order_items oi WHERE oi.order_id = o.id) as items
       FROM orders o WHERE o.id::text = $1 OR o.order_number = $1`,
      [req.params.id]
    )
    
    if (result.rows[0]) {
       return res.json({ order: result.rows[0] })
    }

    // Fallback for mock orders during development/testing
    res.json({ 
      order: {
        id: req.params.id,
        order_number: req.params.id,
        status: "pending",
        payment_status: "pending",
        total: 0,
        subtotal: 0,
        items: [],
        shipping_address: { first_name: "Customer", last_name: "Mock" },
        created_at: new Date()
      }
    })
  } catch (err) { next(err) }
})

// Export at the end if not already exported
// export const storeRouter = Router() was already at the top
