import prisma from '../../config/database'
import { analyzeInput, InputClassification, ComplexityAssessment } from '../classifier'
import { io } from '../../index'

// Secretary 提示词模板
const SECRETARY_SYSTEM_PROMPT = `你是用户的智能秘书（Secretary），负责：
1. 理解用户意图
2. 分析任务类型和复杂度
3. 调度合适的 Worker 执行任务
4. 汇总结果并回复用户

工作流程：
- 用户发送消息后，先分类（问题/需求/执行）
- 根据分类决定处理方式
- 问题类：直接回答或搜索后回答
- 需求类：澄清需求，确认后执行
- 执行类：创建任务，调度 Worker

注意：
- 保持专业、友好的语气
- 复杂任务需要分解步骤
- 及时向用户反馈进度`

/**
 * 处理用户消息的核心逻辑
 */
export async function processUserMessage(
  sessionId: string,
  userMessageId: string,
  content: string
) {
  // 1. 分析输入
  const analysis = analyzeInput(content)

  // 2. 更新消息的分类信息
  await prisma.message.update({
    where: { id: userMessageId },
    data: {
      inputType: analysis.classification.type,
      complexity: analysis.complexity.level
    }
  })

  // 3. 根据分类类型处理
  let responseContent: string

  switch (analysis.classification.type) {
    case 'QUESTION':
      responseContent = await handleQuestion(content, analysis.classification)
      break
    case 'REQUIREMENT':
      responseContent = await handleRequirement(content, analysis)
      break
    case 'EXECUTION':
      responseContent = await handleExecution(content, analysis, sessionId, userMessageId)
      break
    default:
      responseContent = '我收到了您的消息，正在处理中...'
  }

  // 4. 创建 Assistant 消息
  const assistantMessage = await prisma.message.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: responseContent,
      inputType: analysis.classification.type,
      complexity: analysis.complexity.level
    }
  })

  // 5. 广播新消息
  io.to(`session:${sessionId}`).emit('new_message', assistantMessage)

  // 6. 记录上下文历史
  await prisma.contextHistory.create({
    data: {
      sessionId,
      agentId: 'SECRETARY', // 假设 Secretary 的 agentId
      action: 'process_message',
      input: content,
      output: responseContent,
      metadata: {
        classification: analysis.classification,
        complexity: analysis.complexity
      }
    }
  })

  return assistantMessage
}

/**
 * 处理问题类请求
 */
async function handleQuestion(
  content: string,
  classification: InputClassification
): Promise<string> {
  // 简单模拟：根据问题内容生成回答
  const responses: Record<string, string> = {
    'QUESTION': `您的问题是："${content}"

作为一个 AI 助手，我可以帮助您：
- 回答各类问题
- 编写代码
- 设计界面
- 分析数据

请告诉我您具体需要什么帮助？`
  }

  return responses[classification.type] || '感谢您的提问，请告诉我更多细节。'
}

/**
 * 处理需求类请求
 */
async function handleRequirement(
  content: string,
  analysis: { classification: InputClassification; complexity: ComplexityAssessment }
): Promise<string> {
  const complexityText = {
    SIMPLE: '简单',
    MEDIUM: '中等',
    COMPLEX: '复杂'
  }

  return `收到您的需求：${content}

我理解这是一个${complexityText[analysis.complexity.level]}任务。

为了更好地帮您完成，请确认：
1. 您的具体目标是什么？
2. 有没有截止时间？
3. 有没有特定的格式或要求？

请补充更多信息，我会开始为您处理。`
}

/**
 * 处理执行类请求
 */
async function handleExecution(
  content: string,
  analysis: { classification: InputClassification; complexity: ComplexityAssessment },
  sessionId: string,
  messageId: string
): Promise<string> {
  // 1. 创建任务
  const task = await prisma.task.create({
    data: {
      sessionId,
      messageId,
      taskName: extractTaskName(content),
      description: content,
      status: 'IN_PROGRESS',
      complexity: analysis.complexity.level,
      priority: analysis.complexity.level === 'COMPLEX' ? 'HIGH' : 'MEDIUM'
    }
  })

  // 2. 广播任务创建
  io.to(`session:${sessionId}`).emit('task_created', {
    taskId: task.id,
    taskName: task.taskName,
    status: task.status
  })

  // 3. 模拟 Worker 执行（这里先用模拟响应）
  const response = await simulateWorkerExecution(task, content)

  // 4. 更新任务状态
  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: response
    }
  })

  // 5. 广播任务完成
  io.to(`session:${sessionId}`).emit('task_completed', {
    taskId: task.id,
    status: 'COMPLETED',
    result: response
  })

  return response
}

/**
 * 从内容中提取任务名称
 */
function extractTaskName(content: string): string {
  // 简单提取前20个字符作为任务名
  const name = content.substring(0, 20)
  return name.length < content.length ? `${name}...` : name
}

/**
 * 模拟 Worker 执行
 */
async function simulateWorkerExecution(task: any, content: string): Promise<string> {
  // 模拟处理时间
  await new Promise(resolve => setTimeout(resolve, 500))

  return `任务已完成！

任务：${task.taskName}
状态：已完成

这是对您请求"${content}"的处理结果。
具体执行会根据实际需求由相应的 Worker 完成。`
}

/**
 * 为会话分配 Secretary
 */
export async function assignSecretaryToSession(sessionId: string): Promise<string> {
  // 查找 Secretary 类型的 Agent
  const secretary = await prisma.agentProfile.findFirst({
    where: { type: 'SECRETARY' }
  })

  if (!secretary) {
    // 如果没有配置 Secretary，使用默认
    return 'SECRETARY'
  }

  // 更新会话的 secretaryId
  await prisma.session.update({
    where: { id: sessionId },
    data: { secretaryId: secretary.id }
  })

  // 创建 SessionWorker 记录
  await prisma.sessionWorker.upsert({
    where: { sessionId },
    create: {
      sessionId,
      secretaryId: secretary.id,
      status: 'ACTIVE'
    },
    update: {
      secretaryId: secretary.id,
      status: 'ACTIVE',
      lastActiveAt: new Date()
    }
  })

  return secretary.id
}