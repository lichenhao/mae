import { Router } from 'express'
import { z } from 'zod'
import prisma from '../config/database'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// 创建会话验证 schema
const createSessionSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().optional()
})

// 更新会话验证 schema
const updateSessionSchema = z.object({
  title: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'CLOSED']).optional()
})

// 获取用户的所有会话
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        lastActivityAt: true,
        createdAt: true,
        _count: {
          select: { messages: true, tasks: true }
        }
      }
    })
    res.json(sessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 创建新会话
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = createSessionSchema.parse(req.body)

    // 创建会话
    const session = await prisma.session.create({
      data: {
        userId: req.userId!,
        projectId: data.projectId,
        title: data.title || '新对话'
      }
    })

    res.status(201).json(session)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error creating session:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取会话详情
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            inputType: true,
            complexity: true,
            isEdited: true,
            createdAt: true,
            _count: { select: { attachments: true } }
          }
        },
        _count: { select: { tasks: true } }
      }
    })

    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    res.json(session)
  } catch (error) {
    console.error('Error fetching session:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新会话
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = updateSessionSchema.parse(req.body)

    // 检查会话是否属于当前用户
    const existing = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId }
    })

    if (!existing) {
      return res.status(404).json({ error: '会话不存在' })
    }

    const session = await prisma.session.update({
      where: { id: req.params.id },
      data
    })

    res.json(session)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error updating session:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除会话
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.userId }
    })

    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    await prisma.session.delete({
      where: { id: req.params.id }
    })

    res.json({ message: '会话已删除' })
  } catch (error) {
    console.error('Error deleting session:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router