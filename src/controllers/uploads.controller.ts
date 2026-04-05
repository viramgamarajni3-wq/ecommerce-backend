import { Request, Response, NextFunction } from "express"
import type { Express } from "express-serve-static-core"
import { v2 as cloudinary } from "cloudinary"
import multer from "multer"
import { db } from "../db"
import { AppError } from "../utils/AppError"
import { logger } from "../utils/logger"

// Configure Cloudinary lazily to ensure env is ready
const configureCloudinary = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    logger.error("Cloudinary credentials missing in .env")
    return false;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  return true;
}

// Multer: memory storage (files go directly to Cloudinary)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 10,
  },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"))
    }
    cb(null, true)
  },
})

// ─── Helper: Upload buffer to Cloudinary ─────────────────────
async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  options: Record<string, any> = {}
): Promise<{ url: string; publicId: string }> {
  // Final check for configuration
  if (!configureCloudinary()) {
    throw new AppError("Cloudinary is not configured. Please add CLOUDINARY_API_KEY etc. to .env", 500)
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        quality: "auto",
        fetch_format: "auto",
        ...options,
      },
      (error, result) => {
        if (error) return reject(error)
        resolve({ url: result!.secure_url, publicId: result!.public_id })
      }
    )
    uploadStream.end(buffer)
  })
}

// ─── POST /uploads/product-images/:productId ─────────────────
export async function uploadProductImages(req: Request, res: Response, next: NextFunction) {
  try {
    const { productId } = req.params
    const userId = (req as any).user?.userId
    const files = (req as any).files as any[]

    if (!files || files.length === 0) throw new AppError("No files uploaded", 400)

    // Ownership check (Skip for admins)
    const userRole = (req as any).user?.role
    if (userRole !== "admin") {
      const ownerCheck = await db.query(
        `SELECT p.id FROM products p
         JOIN vendors v ON p.vendor_id = v.id
         WHERE p.id = $1 AND v.user_id = $2`,
        [productId, userId]
      )
      if (!ownerCheck.rows[0]) throw new AppError("Product not found or access denied", 403)
    }

    const uploadedImages: { url: string; publicId: string; isPrimary: boolean }[] = []

    // Check if product already has images
    const existingCount = await db.query(
      "SELECT COUNT(*) FROM product_images WHERE product_id = $1",
      [productId]
    )
    const startOrder = parseInt(existingCount.rows[0].count)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isPrimary = startOrder === 0 && i === 0  // First uploaded image is primary

      const { url, publicId } = await uploadToCloudinary(
        file.buffer,
        `ecommerce/products/${productId}`,
        {
          transformation: [
            { width: 1200, height: 1200, crop: "limit" },
            { quality: "auto:good" },
          ],
        }
      )

      await db.query(
        `INSERT INTO product_images (product_id, url, cloudinary_public_id, is_primary, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [productId, url, publicId, isPrimary, startOrder + i]
      )

      uploadedImages.push({ url, publicId, isPrimary })
      logger.info(`✅ Uploaded image: ${publicId}`)
    }

    res.status(201).json({
      success: true,
      message: `${uploadedImages.length} image(s) uploaded successfully`,
      data: uploadedImages,
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /uploads/avatar ────────────────────────────────────
export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const file = (req as any).file as any

    if (!file) throw new AppError("No file uploaded", 400)

    const { url, publicId } = await uploadToCloudinary(
      file.buffer,
      "ecommerce/avatars",
      {
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto" },
        ],
      }
    )

    await db.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [url, userId])

    res.json({ success: true, data: { avatarUrl: url } })
  } catch (err) {
    next(err)
  }
}

// ─── POST /uploads/vendor-logo ────────────────────────────────
export async function uploadVendorLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const file = (req as any).file as any

    if (!file) throw new AppError("No file uploaded", 400)

    const vendorResult = await db.query("SELECT id FROM vendors WHERE user_id = $1", [userId])
    if (!vendorResult.rows[0]) throw new AppError("Vendor not found", 404)

    const { url } = await uploadToCloudinary(file.buffer, "ecommerce/vendor-logos", {
      transformation: [{ width: 400, height: 400, crop: "fill" }],
    })

    await db.query("UPDATE vendors SET logo_url = $1 WHERE user_id = $2", [url, userId])

    res.json({ success: true, data: { logoUrl: url } })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /uploads/product-image/:imageId ──────────────────
export async function deleteProductImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { imageId } = req.params
    const userId = (req as any).user?.userId

    // Ownership check (Skip for admins)
    const userRole = (req as any).user?.role
    let imageResult;

    if (userRole === "admin") {
      imageResult = await db.query(
        "SELECT id, cloudinary_public_id FROM product_images WHERE id = $1",
        [imageId]
      )
    } else {
      imageResult = await db.query(
        `SELECT pi.id, pi.cloudinary_public_id
         FROM product_images pi
         JOIN products p ON pi.product_id = p.id
         JOIN vendors v ON p.vendor_id = v.id
         WHERE pi.id = $1 AND v.user_id = $2`,
        [imageId, userId]
      )
    }

    if (!imageResult.rows[0]) throw new AppError("Image not found or access denied", 403)

    const { cloudinary_public_id } = imageResult.rows[0]

    // Delete from Cloudinary
    if (cloudinary_public_id) {
      await cloudinary.uploader.destroy(cloudinary_public_id)
    }

    await db.query("DELETE FROM product_images WHERE id = $1", [imageId])

    res.json({ success: true, message: "Image deleted successfully" })
  } catch (err) {
    next(err)
  }
}
