import { Request, Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { db } from "../db"
import { AppError } from "../utils/AppError"

const getJwtSecret = () => process.env.JWT_SECRET || "supersecret"
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || getJwtSecret()

// ─── Helper: Generate Tokens ─────────────────────────────────
function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign(
    { userId, role },
    getJwtSecret(),
    { expiresIn: "1d" }
  )
  const refreshToken = jwt.sign(
    { userId },
    getRefreshSecret(),
    { expiresIn: "7d" }
  )
  return { accessToken, refreshToken }
}

// ─── POST /auth/register ─────────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, phone, role, adminInviteCode } = req.body

    if (!email || !password || !firstName || !lastName) {
      throw new AppError("Email, password, first name and last name are required", 400)
    }

    const requestedRole = role === "admin" ? "admin" : "customer"
    if (requestedRole === "admin") {
      const expectedCode = process.env.ADMIN_INVITE_CODE || "admin123"
      if (!adminInviteCode || adminInviteCode !== expectedCode) {
        throw new AppError("Invalid admin invite code", 403)
      }
    }

    const existingUser = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    )
    if (existingUser.rows.length > 0) {
      throw new AppError("An account with this email already exists", 409)
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, phone || null, requestedRole]
    )

    const user = result.rows[0]
    const { accessToken, refreshToken } = generateTokens(user.id, user.role)

    // Store refresh token
    await db.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [refreshToken, user.id])

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role },
        accessToken,
        refreshToken,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /auth/login ────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      throw new AppError("Email and password are required", 400)
    }

    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      throw new AppError("Invalid credentials", 401)
    }

    const user = result.rows[0]

    if (!user.is_active) {
      throw new AppError("Your account has been deactivated. Please contact support.", 403)
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials", 401)
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role)

    await db.query(
      "UPDATE users SET refresh_token = $1, last_login = NOW() WHERE id = $2",
      [refreshToken, user.id]
    )

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id, email: user.email,
          firstName: user.first_name, lastName: user.last_name, role: user.role
        },
        accessToken,
        refreshToken,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── POST /auth/refresh ──────────────────────────────────────
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) throw new AppError("Refresh token is required", 400)

    const decoded = jwt.verify(refreshToken, getRefreshSecret()) as { userId: string }

    const result = await db.query(
      "SELECT id, role, refresh_token FROM users WHERE id = $1",
      [decoded.userId]
    )

    if (!result.rows[0] || result.rows[0].refresh_token !== refreshToken) {
      throw new AppError("Invalid refresh token", 401)
    }

    const user = result.rows[0]
    const tokens = generateTokens(user.id, user.role)

    await db.query("UPDATE users SET refresh_token = $1 WHERE id = $2", [tokens.refreshToken, user.id])

    res.json({ success: true, data: tokens })
  } catch (err) {
    next(err)
  }
}

// ─── POST /auth/logout ───────────────────────────────────────
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    if (userId) {
      await db.query("UPDATE users SET refresh_token = NULL WHERE id = $1", [userId])
    }
    res.json({ success: true, message: "Logged out successfully" })
  } catch (err) {
    next(err)
  }
}

// ─── GET /auth/me ────────────────────────────────────────────
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId

    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, avatar_url, role, is_verified, created_at
       FROM users WHERE id = $1`,
      [userId]
    )

    if (!result.rows[0]) throw new AppError("User not found", 404)

    res.json({ success: true, data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /auth/me ──────────────────────────────────────────
export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const { firstName, lastName, phone, avatarUrl } = req.body || {}

    const result = await db.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           avatar_url = COALESCE($4, avatar_url),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, first_name, last_name, phone, avatar_url, role, is_verified, created_at`,
      [firstName ?? null, lastName ?? null, phone ?? null, avatarUrl ?? null, userId]
    )

    if (!result.rows[0]) throw new AppError("User not found", 404)
    res.json({ success: true, message: "Profile updated successfully", data: result.rows[0] })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /auth/change-password ─────────────────────────────
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.userId
    const { currentPassword, newPassword } = req.body || {}

    if (!currentPassword || !newPassword) {
      throw new AppError("Current password and new password are required", 400)
    }
    if (String(newPassword).length < 8) {
      throw new AppError("New password must be at least 8 characters", 400)
    }

    const userResult = await db.query(
      "SELECT id, password_hash FROM users WHERE id = $1",
      [userId]
    )
    const user = userResult.rows[0]
    if (!user) throw new AppError("User not found", 404)

    const isValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isValid) throw new AppError("Current password is incorrect", 401)

    const newHash = await bcrypt.hash(newPassword, 12)
    await db.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [newHash, userId]
    )

    res.json({ success: true, message: "Password updated successfully" })
  } catch (err) {
    next(err)
  }
}
