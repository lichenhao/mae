import { Router } from 'express'
import { z } from 'zod'
import prisma from '../config/database'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { io } from '../index'
import { processUserMessage, assignSecretaryToSession } from '../agents/secretary/secretary'

const router = Router()

// 发送消息验证 schema
const sendMessageSchema = z.object({
  content: z.string().min(1),
  replyToId: z.string().uuid().optional()
})

// 获取会话消息
router.get('/sessions/:sessionId/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // 验证会话属于当前用户
    const session = await prisma.session.findFirst({
      where: { id: req.params.sessionId, userId: req.userId }
    })

    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    const messages = await prisma.message.findMany({
      where: { sessionId: req.params.sessionId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true
          }
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            role: true
          }
        }
      }
    })

    res.json(messages)
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 发送消息
router.post('/sessions/:sessionId/messages', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = sendMessageSchema.parse(req.body)

    // 验证会话属于当前用户
    const session = await prisma.session.findFirst({
      where: { id: req.params.sessionId, userId: req.userId }
    })

    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    // 创建用户消息
    const message = await prisma.message.create({
      data: {
        sessionId: req.params.sessionId,
        role: 'USER',
        content: data.content,
        replyToId: data.replyToId
      },
      include: {
        attachments: true,
        replyTo: {
          select: {
            id: true,
            content: true,
            role: true
          }
        }
      }
    })

    // 更新会话最后活动时间
    await prisma.session.update({
      where: { id: req.params.sessionId },
      data: { lastActivityAt: new Date() }
    })

    // 广播新消息给客户端
    io.to(`session:${req.params.sessionId}`).emit('new_message', message)

    // 检查会话是否已有 Secretary 分配
    const sessionWorker = await prisma.sessionWorker.findUnique({
      where: { sessionId: req.params.sessionId }
    })

    if (!sessionWorker) {
      // 分配 Secretary
      await assignSecretaryToSession(req.params.sessionId)
    }

    // 触发 Secretary 处理消息
    setTimeout(async () => {
      try {
        await processUserMessage(req.params.sessionId, message.id, data.content)
      } catch (err) {
        console.error('Error processing message:', err)
      }
    }, 100)

    // 返回用户消息
    res.status(201).json(message)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors })
    }
    console.error('Error sending message:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 编辑消息
router.put('/messages/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body

    // 验证消息属于当前用户的会话
    const message = await prisma.message.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      }
    })

    if (!message) {
      return res.status(404).json({ error: '消息不存在' })
    }

    // 不能编辑 AI 消息
    if (message.role !== 'USER') {
      return res.status(400).json({ error: '只能编辑自己的消息' })
    }

    const updated = await prisma.message.update({
      where: { id: req.params.id },
      data: {
        content,
        isEdited: true,
        editedAt: new Date()
      }
    })

    // 广播更新
    io.to(`session:${message.sessionId}`).emit('message_updated', updated)

    res.json(updated)
  } catch (error) {
    console.error('Error updating message:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除消息（软删除）
router.delete('/messages/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const message = await prisma.message.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      }
    })

    if (!message) {
      return res.status(404).json({ error: '消息不存在' })
    }

    // 不能删除 AI 消息（软删除）
    if (message.role !== 'USER') {
      return res.status(400).json({ error: '只能删除自己的消息' })
    }

    await prisma.message.update({
      where: { id: req.params.id },
      data: {
        isDeleted: true,
        deletedAt: new Date()
      }
    })

    // 广播删除
    io.to(`session:${message.sessionId}`).emit('message_deleted', { id: req.params.id })

    res.json({ message: '消息已删除' })
  } catch (error) {
    console.error('Error deleting message:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router