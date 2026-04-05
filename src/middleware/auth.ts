import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { AppError } from "../utils/AppError"

// Access JWT secret inside functions to avoid evaluation-time issues with ESM imports
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || "supersecret"
  if (secret === "supersecret") {
    console.warn("[AUTH] Using default fallback secret 'supersecret'")
  } else {
    console.log(`[AUTH] Using configured secret starting with '${secret.substring(0, 2)}...'`)
  }
  return secret
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    console.log("[AUTH] No Bearer token found in header")
    return next(new AppError("Authentication required", 401))
  }
  const token = authHeader.split(" ")[1]
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; role: string }
    ;(req as any).user = decoded
    next()
  } catch (err: any) {
    console.error(`[AUTH] JWT Verification Failed: ${err.message}`, { token: token.substring(0, 10) + "..." })
    next(new AppError("Invalid or expired token", 401))
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user || !roles.includes(user.role)) {
      return next(new AppError("Insufficient permissions", 403))
    }
    next()
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1]
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as { userId: string; role: string }
      ;(req as any).user = decoded
    } catch {}
  }
  next()
}
