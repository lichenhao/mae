import { Router } from 'express'
import prisma from '../config/database'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { executeTool } from '../services/file-tool'

const router = Router()

// ==================== Agent 管理 ====================

// 获取所有 Agent
router.get('/agents', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const agents = await prisma.agentProfile.findMany({
      include: {
        skills: {
          include: { skill: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.json(agents)
  } catch (error) {
    console.error('Error fetching agents:', error)
    res.status(500).json({ error: '获取Agent失败' })
  }
})

// 获取单个 Agent
router.get('/agents/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const agent = await prisma.agentProfile.findUnique({
      where: { id: req.params.id },
      include: {
        skills: {
          include: { skill: true }
        }
      }
    })

    if (!agent) {
      return res.status(404).json({ error: 'Agent不存在' })
    }

    res.json(agent)
  } catch (error) {
    console.error('Error fetching agent:', error)
    res.status(500).json({ error: '获取Agent失败' })
  }
})

// 创建 Agent
router.post('/agents', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code, name, description, avatar, type, basePrompt } = req.body

    const agent = await prisma.agentProfile.create({
      data: {
        code,
        name,
        description,
        avatar,
        type: type || 'WORKER',
        basePrompt: basePrompt || ''
      }
    })

    res.status(201).json(agent)
  } catch (error) {
    console.error('Error creating agent:', error)
    res.status(500).json({ error: '创建Agent失败' })
  }
})

// 更新 Agent
router.put('/agents/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description, avatar, basePrompt } = req.body

    const agent = await prisma.agentProfile.update({
      where: { id: req.params.id },
      data: { name, description, avatar, basePrompt }
    })

    res.json(agent)
  } catch (error) {
    console.error('Error updating agent:', error)
    res.status(500).json({ error: '更新Agent失败' })
  }
})

// 删除 Agent
router.delete('/agents/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.agentProfile.delete({
      where: { id: req.params.id }
    })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Error deleting agent:', error)
    res.status(500).json({ error: '删除Agent失败' })
  }
})

// ==================== Skill 管理 ====================

// 获取所有 Skills
router.get('/skills', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const skills = await prisma.skillProfile.findMany({
      orderBy: { createdAt: 'desc' }
    })
    res.json(skills)
  } catch (error) {
    console.error('Error fetching skills:', error)
    res.status(500).json({ error: '获取Skill失败' })
  }
})

// 获取单个 Skill
router.get('/skills/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const skill = await prisma.skillProfile.findUnique({
      where: { id: req.params.id }
    })

    if (!skill) {
      return res.status(404).json({ error: 'Skill不存在' })
    }

    res.json(skill)
  } catch (error) {
    console.error('Error fetching skill:', error)
    res.status(500).json({ error: '获取Skill失败' })
  }
})

// 创建 Skill
router.post('/skills', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code, name, description, enabled, config } = req.body

    const skill = await prisma.skillProfile.create({
      data: {
        code,
        name,
        description,
        enabled: enabled ?? true,
        config: config || {}
      }
    })

    res.status(201).json(skill)
  } catch (error) {
    console.error('Error creating skill:', error)
    res.status(500).json({ error: '创建Skill失败' })
  }
})

// 更新 Skill
router.put('/skills/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description, enabled, config } = req.body

    const skill = await prisma.skillProfile.update({
      where: { id: req.params.id },
      data: { name, description, enabled, config }
    })

    res.json(skill)
  } catch (error) {
    console.error('Error updating skill:', error)
    res.status(500).json({ error: '更新Skill失败' })
  }
})

// 删除 Skill
router.delete('/skills/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.skillProfile.delete({
      where: { id: req.params.id }
    })
    res.json({ message: '删除成功' })
  } catch (error) {
    console.error('Error deleting skill:', error)
    res.status(500).json({ error: '删除Skill失败' })
  }
})

// ==================== Agent-Skill 绑定 ====================

// 为 Agent 绑定 Skill
router.post('/agents/:agentId/skills', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { skillId, priority, enabled } = req.body

    // 检查 agent 和 skill 是否存在
    const agent = await prisma.agentProfile.findUnique({
      where: { id: req.params.agentId }
    })
    const skill = await prisma.skillProfile.findUnique({
      where: { id: skillId }
    })

    if (!agent || !skill) {
      return res.status(404).json({ error: 'Agent或Skill不存在' })
    }

    const binding = await prisma.agentSkillBinding.upsert({
      where: {
        agentId_skillId: {
          agentId: req.params.agentId,
          skillId
        }
      },
      create: {
        agentId: req.params.agentId,
        skillId,
        priority: priority || 0,
        enabled: enabled ?? true
      },
      update: {
        priority: priority || 0,
        enabled: enabled ?? true
      }
    })

    res.status(201).json(binding)
  } catch (error) {
    console.error('Error binding skill:', error)
    res.status(500).json({ error: '绑定Skill失败' })
  }
})

// 解除 Agent 的 Skill 绑定
router.delete('/agents/:agentId/skills/:skillId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.agentSkillBinding.delete({
      where: {
        agentId_skillId: {
          agentId: req.params.agentId,
          skillId: req.params.skillId
        }
      }
    })
    res.json({ message: '解除绑定成功' })
  } catch (error) {
    console.error('Error unbinding skill:', error)
    res.status(500).json({ error: '解除绑定失败' })
  }
})

// ==================== Agent 执行 Skill（供 Agent 使用）====================

// Agent 查找可用 Skills
router.get(
  '/agents/:agentId/available-skills',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { agentId } = req.params

      // 获取 Agent 绑定的且启用的 Skills
      const bindings = await prisma.agentSkillBinding.findMany({
        where: {
          agentId,
          enabled: true
        },
        include: {
          skill: true
        },
        orderBy: { priority: 'desc' }
      })

      res.json(bindings.map(b => b.skill))
    } catch (error) {
      console.error('Error fetching available skills:', error)
      res.status(500).json({ error: '获取可用Skills失败' })
    }
  }
)

// Agent 执行 Skill（通过 Tool 机制）
router.post(
  '/agents/execute-tool',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { toolName, args } = req.body

      const result = await executeTool(toolName, args)
      res.json({ result })
    } catch (error) {
      console.error('Error executing tool:', error)
      res.status(500).json({ error: '执行Tool失败' })
    }
  }
)

export default router