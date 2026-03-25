import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import prisma from '../config/database'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import {
  uploadFile,
  getAttachment,
  getSessionAttachments,
  deleteAttachment,
  getFileContent
} from '../services/file.service'

const router = Router()

// 配置 multer 存储
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB
  }
})

// 上传附件
router.post(
  '/sessions/:sessionId/attachments',
  authMiddleware,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: '没有文件' })
      }

      // 解码文件名（前端可能进行了 URL 编码）
      let fileName = file.originalname
      console.log('[Upload] Raw filename:', fileName)

      try {
        // 先尝试解码 URL 编码的中文
        fileName = decodeURIComponent(fileName)
        console.log('[Upload] Decoded filename:', fileName)
      } catch (e) {
        console.log('[Upload] Decode failed, trying UTF-8 buffer...')
        // 如果解码失败，尝试从 Buffer 解码
        if (file.originalname) {
          fileName = Buffer.from(file.originalname, 'latin1').toString('utf8')
          console.log('[Upload] Buffer decoded:', fileName)
        }
      }

      // 验证会话属于当前用户
      const session = await prisma.session.findFirst({
        where: { id: sessionId, userId: req.userId }
      })

      if (!session) {
        return res.status(404).json({ error: '会话不存在' })
      }

      // 上传文件
      const result = await uploadFile(sessionId, {
        name: fileName,
        type: file.mimetype,
        size: file.size,
        chunk: file.buffer
      })

      res.json({
        attachmentId: result.attachmentId,
        isExisting: result.isExisting,
        file: {
          id: result.fileInfo.id,
          name: result.fileInfo.fileName,
          type: result.fileInfo.fileType,
          size: result.fileInfo.fileSize
        }
      })
    } catch (error) {
      console.error('Upload error:', error)
      res.status(500).json({ error: '上传失败' })
    }
  }
)

// 获取会话的所有附件
router.get(
  '/sessions/:sessionId/attachments',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { sessionId } = req.params

      const session = await prisma.session.findFirst({
        where: { id: sessionId, userId: req.userId }
      })

      if (!session) {
        return res.status(404).json({ error: '会话不存在' })
      }

      const attachments = await getSessionAttachments(sessionId)
      res.json(attachments.map(a => ({
        id: a.id,
        name: a.fileName,
        type: a.fileType,
        size: a.fileSize,
        createdAt: a.createdAt
      })))
    } catch (error) {
      console.error('Error fetching attachments:', error)
      res.status(500).json({ error: '获取附件失败' })
    }
  }
)

// 获取单个附件信息
router.get(
  '/attachments/:id',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params

      const attachment = await prisma.attachment.findFirst({
        where: {
          id,
          session: { userId: req.userId }
        }
      })

      if (!attachment) {
        return res.status(404).json({ error: '附件不存在' })
      }

      res.json({
        id: attachment.id,
        name: attachment.fileName,
        type: attachment.fileType,
        size: attachment.fileSize,
        createdAt: attachment.createdAt
      })
    } catch (error) {
      console.error('Error fetching attachment:', error)
      res.status(500).json({ error: '获取附件失败' })
    }
  }
)

// 下载附件
router.get(
  '/attachments/:id/download',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params

      const attachment = await prisma.attachment.findFirst({
        where: {
          id,
          session: { userId: req.userId }
        }
      })

      if (!attachment) {
        return res.status(404).json({ error: '附件不存在' })
      }

      const content = await getFileContent(id)
      if (!content) {
        return res.status(404).json({ error: '文件不存在' })
      }

      res.setHeader('Content-Type', attachment.fileType)
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`)
      res.send(content)
    } catch (error) {
      console.error('Error downloading attachment:', error)
      res.status(500).json({ error: '下载失败' })
    }
  }
)

// 删除附件
router.delete(
  '/attachments/:id',
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params

      const attachment = await prisma.attachment.findFirst({
        where: {
          id,
          session: { userId: req.userId }
        }
      })

      if (!attachment) {
        return res.status(404).json({ error: '附件不存在' })
      }

      await deleteAttachment(id)
      res.json({ message: '删除成功' })
    } catch (error) {
      console.error('Error deleting attachment:', error)
      res.status(500).json({ error: '删除失败' })
    }
  }
)

export default router