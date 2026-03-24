import { Router } from 'express'
import { z } from 'zod'
import prisma from '../config/database'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { io } from '../index'

const router = Router()

// 获取会话的任务列表
router.get('/sessions/:sessionId/tasks', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // 验证会话属于当前用户
    const session = await prisma.session.findFirst({
      where: { id: req.params.sessionId, userId: req.userId }
    })

    if (!session) {
      return res.status(404).json({ error: '会话不存在' })
    }

    const tasks = await prisma.task.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        taskName: true,
        description: true,
        status: true,
        priority: true,
        complexity: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        assignedAgentId: true,
        _count: { select: { workProducts: true } }
      }
    })

    res.json(tasks)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取任务详情
router.get('/tasks/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      },
      include: {
        session: {
          select: { id: true, title: true }
        },
        workProducts: true,
        contextHistory: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    res.json(task)
  } catch (error) {
    console.error('Error fetching task:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新任务状态
router.put('/tasks/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body

    // 验证任务属于当前用户的会话
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      }
    })

    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    const updateData: any = { status }

    if (status === 'IN_PROGRESS' && !task.startedAt) {
      updateData.startedAt = new Date()
    }

    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      updateData.completedAt = new Date()
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: updateData
    })

    // 广播任务状态更新
    io.to(`session:${task.sessionId}`).emit('task_update', {
      taskId: task.id,
      status: updated.status,
      progress: updated.status === 'COMPLETED' ? 100 : 0
    })

    res.json(updated)
  } catch (error) {
    console.error('Error updating task status:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 取消任务
router.post('/tasks/:id/cancel', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      }
    })

    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    if (task.status === 'COMPLETED' || task.status === 'FAILED' || task.status === 'CANCELLED') {
      return res.status(400).json({ error: '任务已结束，无法取消' })
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        cancelRequested: true,
        cancelledAt: new Date(),
        status: 'CANCELLED'
      }
    })

    // 广播任务取消
    io.to(`session:${task.sessionId}`).emit('task_completed', {
      taskId: task.id,
      status: 'CANCELLED'
    })

    res.json(updated)
  } catch (error) {
    console.error('Error cancelling task:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 确认/打回任务
router.post('/tasks/:id/approve', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { approved, feedback } = req.body

    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      }
    })

    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    // 记录绩效
    await prisma.agentPerformance.create({
      data: {
        agentId: task.assignedAgentId || 'UNKNOWN',
        taskId: task.id,
        sessionId: task.sessionId,
        status: approved ? 'SUCCESS' : 'REJECTED',
        feedback: feedback || null,
        rejectReason: approved ? null : (feedback || '用户打回')
      }
    })

    if (!approved) {
      // 打回任务，重新设置为待处理
      await prisma.task.update({
        where: { id: req.params.id },
        data: {
          status: 'PENDING',
          completedAt: null
        }
      })

      io.to(`session:${task.sessionId}`).emit('task_rejected', {
        taskId: task.id,
        feedback
      })
    }

    res.json({ message: approved ? '任务已确认' : '任务已打回' })
  } catch (error) {
    console.error('Error approving/rejecting task:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取任务产物
router.get('/tasks/:id/products', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      }
    })

    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    const products = await prisma.workProduct.findMany({
      where: { taskId: req.params.id }
    })

    res.json(products)
  } catch (error) {
    console.error('Error fetching task products:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取任务执行历史
router.get('/tasks/:id/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: req.params.id,
        session: { userId: req.userId }
      }
    })

    if (!task) {
      return res.status(404).json({ error: '任务不存在' })
    }

    const history = await prisma.contextHistory.findMany({
      where: { taskId: req.params.id },
      orderBy: { createdAt: 'asc' }
    })

    res.json(history)
  } catch (error) {
    console.error('Error fetching task history:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

export default router