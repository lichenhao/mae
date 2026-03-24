import { Router } from 'express'
import { z } from 'zod'
import { register, login, getCurrentUser, updateProfile } from '../services/auth.service'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// 注册验证 schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nickname: z.string().optional()
})

// 登录验证 schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
})

// 更新资料验证 schema
const updateProfileSchema = z.object({
  nickname: z.string().optional(),
  avatar: z.string().optional()
})

// 注册
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body)
    const result = await register(data.email, data.password, data.nickname)
    res.status(201).json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: '服务器错误' })
  }
})

// 登录
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body)
    const result = await login(data.email, data.password)
    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    if (error instanceof Error) {
      return res.status(401).json({ error: error.message })
    }
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取当前用户
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await getCurrentUser(req.userId!)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新用户资料
router.put('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = updateProfileSchema.parse(req.body)
    const user = await updateProfile(req.userId!, data)
    res.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    res.status(500).json({ error: '服务器错误' })
  }
})

// 登出（客户端移除 token 即可，这里预留接口）
router.post('/logout', (req, res) => {
  res.json({ message: '已登出' })
})

export default router