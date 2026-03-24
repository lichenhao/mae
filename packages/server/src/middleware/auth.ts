import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../services/auth.service'

export interface AuthRequest extends Request {
  userId?: string
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: '未登录' })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'Token 无效' })
  }

  req.userId = decoded.userId
  next()
}

// 可选的认证中间件（不强制登录）
export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  if (token) {
    const decoded = verifyToken(token)
    if (decoded) {
      req.userId = decoded.userId
    }
  }

  next()
}