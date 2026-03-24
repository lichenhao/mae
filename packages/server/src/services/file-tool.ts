import prisma from '../config/database'
import { getAttachment, getFileContent } from './file.service'

/**
 * 文件读取 Tool - 供 Agent 使用
 * Tool name: read_file
 * Description: 读取上传的附件内容
 */
export const readFileTool = {
  name: 'read_file',
  description: '读取上传的附件内容。根据附件ID返回文件内容，支持文本文件和代码。',
  inputSchema: {
    type: 'object' as const,
    properties: {
      attachmentId: {
        type: 'string',
        description: '附件ID'
      }
    },
    required: ['attachmentId']
  }
}

/**
 * 读取文件内容
 */
export async function readFileById(attachmentId: string): Promise<string> {
  const attachment = await getAttachment(attachmentId)

  if (!attachment) {
    return `错误：找不到ID为 ${attachmentId} 的附件`
  }

  const content = await getFileContent(attachmentId)

  if (!content) {
    return `错误：找不到文件内容`
  }

  // 对于文本类型文件，返回内容
  const textTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/xml',
    'application/x-python',
    'markdown',
    'md'
  ]

  const isText = textTypes.some(t => attachment.fileType.includes(t)) ||
    attachment.fileName.endsWith('.txt') ||
    attachment.fileName.endsWith('.md') ||
    attachment.fileName.endsWith('.json') ||
    attachment.fileName.endsWith('.js') ||
    attachment.fileName.endsWith('.ts') ||
    attachment.fileName.endsWith('.py') ||
    attachment.fileName.endsWith('.html') ||
    attachment.fileName.endsWith('.css') ||
    attachment.fileName.endsWith('.xml') ||
    attachment.fileName.endsWith('.yaml') ||
    attachment.fileName.endsWith('.yml')

  if (isText) {
    return `文件: ${attachment.fileName}\n类型: ${attachment.fileType}\n大小: ${attachment.fileSize} bytes\n\n内容:\n${content.toString('utf-8')}`
  }

  return `文件: ${attachment.fileName}\n类型: ${attachment.fileType}\n大小: ${attachment.fileSize} bytes\n\n(此文件为二进制文件，无法直接显示内容)`
}

/**
 * 列出会话的附件
 */
export async function listSessionAttachmentsTool(sessionId: string) {
  const attachments = await prisma.attachment.findMany({
    where: { sessionId },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  return attachments
}

/**
 * 获取所有可用 Tools
 */
export function getAvailableTools() {
  return [
    readFileTool,
    {
      name: 'list_attachments',
      description: '列出当前会话的所有附件',
      inputSchema: {
        type: 'object' as const,
        properties: {
          sessionId: {
            type: 'string',
            description: '会话ID'
          }
        },
        required: ['sessionId']
      }
    }
  ]
}

/**
 * 执行 Tool
 */
export async function executeTool(
  toolName: string,
  args: { attachmentId?: string; sessionId?: string }
): Promise<string> {
  switch (toolName) {
    case 'read_file':
      if (!args.attachmentId) {
        return '错误：缺少 attachmentId 参数'
      }
      return readFileById(args.attachmentId)

    case 'list_attachments':
      if (!args.sessionId) {
        return '错误：缺少 sessionId 参数'
      }
      const attachments = await listSessionAttachmentsTool(args.sessionId)
      if (attachments.length === 0) {
        return '当前会话没有附件'
      }
      return `附件列表:\n${attachments.map(a =>
        `- ${a.fileName} (${a.fileType}, ${a.fileSize} bytes, ID: ${a.id})`
      ).join('\n')}`

    default:
      return `错误：未知工具 ${toolName}`
  }
}