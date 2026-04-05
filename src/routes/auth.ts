import { Router } from "express"
import { register, login, refreshToken, logout, getMe, updateMe, changePassword } from "../controllers/auth.controller"
import { authenticate } from "../middleware/auth"

export const authRouter = Router()

authRouter.post("/register", register)
authRouter.post("/login", login)
authRouter.post("/refresh", refreshToken)
authRouter.post("/logout", authenticate, logout)
authRouter.get("/me", authenticate, getMe)
authRouter.patch("/me", authenticate, updateMe)
authRouter.patch("/change-password", authenticate, changePassword)
