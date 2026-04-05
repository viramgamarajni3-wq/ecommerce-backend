import { Router } from "express"
import { upload, uploadProductImages, uploadAvatar, uploadVendorLogo, deleteProductImage } from "../controllers/uploads.controller"
import { authenticate, authorize } from "../middleware/auth"

export const uploadsRouter = Router()

uploadsRouter.post(
  "/product-images/:productId",
  authenticate,
  authorize("vendor", "admin"),
  upload.array("images", 10) as any,
  uploadProductImages
)
uploadsRouter.post("/avatar", authenticate, upload.single("avatar") as any, uploadAvatar)
uploadsRouter.post("/vendor-logo", authenticate, authorize("vendor", "admin"), upload.single("logo") as any, uploadVendorLogo)
uploadsRouter.delete("/product-image/:imageId", authenticate, authorize("vendor", "admin"), deleteProductImage)
