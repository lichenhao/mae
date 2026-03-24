import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import prisma from '../config/database'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const CHUNK_SIZE = 1024 * 1024 * 5 // 5MB chunks

// 确保上传目录存在
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}

/**
 * 计算文件哈希
 */
function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (data) => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * 计算 Buffer 哈希
 */
function calculateBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * 检查文件是否已存在（通过哈希）
 */
async function findExistingFile(fileHash: string): Promise<string | null> {
  const existing = await prisma.attachment.findFirst({
    where: { fileHash },
    select: { id: true }
  })
  return existing?.id || null
}

/**
 * 上传文件（支持分片）
 */
export async function uploadFile(
  sessionId: string,
  file: {
    name: string
    type: string
    size: number
    chunk?: Buffer
    chunks?: Buffer[]
  },
  messageId?: string
): Promise<{ attachmentId: string; isExisting: boolean; fileInfo: any }> {
  ensureUploadDir()

  // 收集所有分片
  const allChunks = file.chunks ? file.chunks : (file.chunk ? [file.chunk] : [])
  const fullBuffer = Buffer.concat(allChunks)

  // 计算哈希
  const fileHash = calculateBufferHash(fullBuffer)

  // 检查是否已存在
  const existingId = await findExistingFile(fileHash)
  if (existingId) {
    // 如果文件已存在，直接返回现有记录
    const attachment = await prisma.attachment.findUnique({
      where: { id: existingId }
    })
    return {
      attachmentId: existingId,
      isExisting: true,
      fileInfo: attachment
    }
  }

  // 生成唯一文件名
  const ext = path.extname(file.name)
  const baseName = path.basename(file.name, ext)
  const hashPrefix = fileHash.substring(0, 8)
  const uniqueFileName = `${baseName}_${hashPrefix}_${Date.now()}${ext}`
  const filePath = path.join(UPLOAD_DIR, uniqueFileName)

  // 写入文件
  fs.writeFileSync(filePath, fullBuffer)

  // 创建数据库记录
  const attachment = await prisma.attachment.create({
    data: {
      sessionId,
      messageId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      filePath: uniqueFileName,
      fileHash
    }
  })

  return {
    attachmentId: attachment.id,
    isExisting: false,
    fileInfo: attachment
  }
}

/**
 * 读取文件内容
 */
export async function getFileContent(attachmentId: string): Promise<Buffer | null> {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId }
  })

  if (!attachment) {
    return null
  }

  const filePath = path.join(UPLOAD_DIR, attachment.filePath)
  if (!fs.existsSync(filePath)) {
    return null
  }

  return fs.readFileSync(filePath)
}

/**
 * 获取附件信息
 */
export async function getAttachment(attachmentId: string) {
  return prisma.attachment.findUnique({
    where: { id: attachmentId }
  })
}

/**
 * 获取会话的所有附件
 */
export async function getSessionAttachments(sessionId: string) {
  return prisma.attachment.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' }
  })
}

/**
 * 删除附件
 */
export async function deleteAttachment(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId }
  })

  if (attachment) {
    const filePath = path.join(UPLOAD_DIR, attachment.filePath)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    await prisma.attachment.delete({ where: { id: attachmentId } })
  }
}