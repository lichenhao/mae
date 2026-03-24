import prisma from '../../config/database'
import { analyzeInput, InputClassification, ComplexityAssessment } from '../classifier'
import { generateCompletion, generateCompletionStream, LLMMessage } from '../../services/llm'
import { io } from '../../index'

// Secretary 系统提示词
const SECRETARY_SYSTEM_PROMPT = `你是用户的智能秘书（Secretary），负责：
1. 理解用户意图并分类
2. 分析任务类型和复杂度
3. 调度合适的 Worker 执行任务
4. 汇总结果并回复用户

工作流程：
- 用户发送消息后，先分类（问题/需求/执行）
- 问题类：直接回答
- 需求类：澄清需求，确认后执行
- 执行类：创建任务，调度 Worker

风格要求：
- 保持专业、友好的语气
- 复杂任务需要分解步骤
- 及时向用户反馈进度
- 用中文回复用户`

// Worker 系统提示词
const WORKER_SYSTEM_PROMPT = `你是一个专业的任务执行专家（Worker）。你的职责是根据用户需求执行具体任务。

工作要求：
1. 仔细分析任务需求
2. 制定执行计划
3. 逐步执行并记录过程
4. 产出可交付的结果

输出格式要求：
- 清晰的结构化输出
- 包含执行步骤和结果
- 如遇问题，说明原因和建议`

// 任务执行提示词模板
const EXECUTION_TEMPLATE = `
用户需求：{taskDescription}

请执行这个任务，完成后返回执行结果。
`

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

  // 3. 记录上下文
  await prisma.contextHistory.create({
    data: {
      sessionId,
      agentId: 'SECRETARY',
      action: 'analyze_input',
      input: content,
      output: JSON.stringify({ classification: analysis.classification, complexity: analysis.complexity })
    }
  })

  // 4. 根据分类类型处理
  let responseContent: string

  switch (analysis.classification.type) {
    case 'QUESTION':
      responseContent = await handleQuestion(content)
      break
    case 'REQUIREMENT':
      responseContent = await handleRequirement(content, analysis)
      break
    case 'EXECUTION':
      responseContent = await handleExecution(content, analysis, sessionId, userMessageId)
      break
    default:
      responseContent = await handleDirect(content)
  }

  // 5. 创建 Assistant 消息
  const assistantMessage = await prisma.message.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: responseContent,
      inputType: analysis.classification.type,
      complexity: analysis.complexity.level
    }
  })

  // 6. 广播新消息
  io.to(`session:${sessionId}`).emit('new_message', assistantMessage)

  return assistantMessage
}

/**
 * 处理问题类请求 - 直接用 LLM 回答
 */
async function handleQuestion(content: string): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'user', content }
  ]

  try {
    const response = await generateCompletion(
      messages,
      SECRETARY_SYSTEM_PROMPT
    )
    return response.content
  } catch (error) {
    console.error('Error handling question:', error)
    return `您的问题是："${content}"

我正在思考如何回答您的问题，请稍等...`
  }
}

/**
 * 处理需求类请求
 */
async function handleRequirement(
  content: string,
  analysis: { classification: InputClassification; complexity: ComplexityAssessment }
): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'user', content: `用户需求：${content}\n\n复杂度：${analysis.complexity.level}\n\n请确认需求并给出执行计划。` }
  ]

  try {
    const response = await generateCompletion(
      messages,
      SECRETARY_SYSTEM_PROMPT
    )
    return response.content
  } catch (error) {
    console.error('Error handling requirement:', error)
    return `好的，我收到了您的需求：${content}\n\n请确认这是否是您想要的，我会开始执行。`
  }
}

/**
 * 处理执行类请求 - 创建任务并调度 Worker
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
      status: 'PENDING',
      complexity: analysis.complexity.level as any,
      priority: analysis.complexity.level === 'COMPLEX' ? 'HIGH' : 'MEDIUM'
    }
  })

  // 2. 广播任务创建
  io.to(`session:${sessionId}`).emit('task_created', {
    taskId: task.id,
    taskName: task.taskName,
    status: task.status,
    priority: task.priority
  })

  // 3. 返回任务创建消息给用户
  const initialMessage = `好的，我已收到您的任务需求，正在开始执行...\n\n📋 **任务**：${task.taskName}\n📊 **复杂度**：${analysis.complexity.level}\n🔄 **状态**：等待执行中`

  // 4. 异步开始任务执行（不阻塞响应）
  executeTask(task.id, content, sessionId).catch(err => {
    console.error('Task execution error:', err)
  })

  return initialMessage
}

/**
 * 直接处理（非分类的请求）
 */
async function handleDirect(content: string): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'user', content }
  ]

  try {
    const response = await generateCompletion(
      messages,
      SECRETARY_SYSTEM_PROMPT
    )
    return response.content
  } catch (error) {
    console.error('Error handling direct request:', error)
    return '我收到了您的消息，正在处理中...'
  }
}

/**
 * 执行任务 - 调度 Worker
 */
async function executeTask(taskId: string, content: string, sessionId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) return

  // 1. 更新任务状态为进行中
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      assignedAgentId: 'WORKER'
    }
  })

  // 2. 广播任务开始执行
  io.to(`session:${sessionId}`).emit('task_update', {
    taskId,
    status: 'IN_PROGRESS',
    progress: 10
  })

  // 3. 记录开始执行
  await prisma.contextHistory.create({
    data: {
      sessionId,
      taskId,
      agentId: 'WORKER',
      action: 'task_started',
      input: content,
      output: 'Worker 开始执行任务'
    }
  })

  try {
    // 4. 构建 Worker 执行提示
    const workerMessages: LLMMessage[] = [
      {
        role: 'user',
        content: EXECUTION_TEMPLATE.replace('{taskDescription}', content)
      }
    ]

    // 5. 流式执行并收集结果
    let fullResult = ''
    let progress = 20

    // 发送进度更新
    io.to(`session:${sessionId}`).emit('task_progress', {
      taskId,
      progress,
      status: 'executing',
      message: '正在分析任务需求...'
    })

    // 调用 LLM 执行
    for await (const chunk of generateCompletionStream(
      workerMessages,
      WORKER_SYSTEM_PROMPT
    )) {
      fullResult += chunk

      // 每隔一段时间更新进度
      progress = Math.min(progress + 2, 90)
      io.to(`session:${sessionId}`).emit('task_progress', {
        taskId,
        progress,
        status: 'executing',
        message: '正在执行任务...',
        partialResult: fullResult.slice(-200)
      })
    }

    // 6. 创建工作产物
    await prisma.workProduct.create({
      data: {
        taskId,
        name: '执行结果',
        type: 'TEXT',
        content: fullResult
      }
    })

    // 7. 更新任务完成
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: fullResult
      }
    })

    // 8. 记录完成
    await prisma.contextHistory.create({
      data: {
        sessionId,
        taskId,
        agentId: 'WORKER',
        action: 'task_completed',
        input: content,
        output: fullResult.slice(0, 500)
      }
    })

    // 9. 广播任务完成
    io.to(`session:${sessionId}`).emit('task_completed', {
      taskId,
      status: 'COMPLETED',
      result: fullResult,
      progress: 100
    })

    // 10. 创建 Worker 消息通知用户
    const workerMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'WORKER',
        content: `✅ **任务已完成**\n\n${fullResult}`,
        inputType: 'EXECUTION'
      }
    })

    io.to(`session:${sessionId}`).emit('new_message', workerMessage)

  } catch (error: any) {
    console.error('Task execution error:', error)

    // 更新任务失败状态
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message || '执行失败'
      }
    })

    // 广播任务失败
    io.to(`session:${sessionId}`).emit('task_update', {
      taskId,
      status: 'FAILED',
      error: error.message
    })
  }
}

/**
 * 从内容中提取任务名称
 */
function extractTaskName(content: string): string {
  // 简单提取前30个字符作为任务名
  const name = content.substring(0, 30)
  return name.length < content.length ? `${name}...` : name
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

/**
 * 手动触发任务执行（用于测试）
 */
export async function runTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { session: true }
  })

  if (!task) {
    throw new Error('Task not found')
  }

  await executeTask(taskId, task.description || task.taskName, task.sessionId)
}