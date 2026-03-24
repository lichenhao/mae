import jwt, { SignOptions } from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import prisma from '../config/database'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// 生成 Token
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' } as SignOptions)
}

// 验证 Token
export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch {
    return null
  }
}

// 密码哈希
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// 验证密码
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// 注册
export async function register(email: string, password: string, nickname?: string) {
  // 检查用户是否存在
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    throw new Error('用户已存在')
  }

  // 创建用户
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      nickname: nickname || email.split('@')[0]
    }
  })

  // 生成 Token
  const token = generateToken(user.id)

  return { user: { id: user.id, email: user.email, nickname: user.nickname }, token }
}

// 登录
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    throw new Error('用户不存在')
  }

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    throw new Error('密码错误')
  }

  const token = generateToken(user.id)

  return { user: { id: user.id, email: user.email, nickname: user.nickname }, token }
}

// 获取当前用户
export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, nickname: true, avatar: true, createdAt: true }
  })
  return user
}

// 更新用户资料
export async function updateProfile(userId: string, data: { nickname?: string; avatar?: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, nickname: true, avatar: true }
  })
  return user
}