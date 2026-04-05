import { Request, Response, NextFunction } from "express"
import { AppError } from "../utils/AppError"
import { logger } from "../utils/logger"

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error(`[${req.method}] ${req.path} - ${err.message}`, {
    stack: err.stack,
    body: req.body,
  })

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    })
  }

  // Postgres unique constraint violation
  if ((err as any).code === "23505") {
    return res.status(409).json({
      success: false,
      error: "A record with this value already exists",
    })
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authentication token",
    })
  }

  // Default 500 (Showing full error message temporarily for debugging)
  return res.status(500).json({
    success: false,
    error: err.message || "An internal server error occurred",
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  })
}
