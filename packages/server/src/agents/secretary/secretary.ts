import prisma from '../../config/database'
import { analyzeInput, InputClassification, ComplexityAssessment } from '../classifier'
import { generateCompletion, generateCompletionStream, LLMMessage } from '../../services/llm'
import { readFileById } from '../../services/file-tool'
import { io } from '../../index'

// 从数据库加载 Agent 配置的缓存
type AgentCacheKey = 'secretary' | 'worker' | 'manager'
let agentConfigCache: Record<AgentCacheKey, { basePrompt: string; name: string } | null> = {
  secretary: null,
  worker: null,
  manager: null
}

// 缓存过期时间（5分钟）
const CACHE_TTL = 5 * 60 * 1000
let lastCacheTime = 0

/**
 * 加载 Agent 配置（从数据库读取 basePrompt）
 */
async function loadAgentConfig(agentType: 'SECRETARY' | 'WORKER'): Promise<{ basePrompt: string; name: string }> {
  const now = Date.now()
  const cacheKey: AgentCacheKey = agentType.toLowerCase() as AgentCacheKey

  // 检查缓存
  if (agentConfigCache[cacheKey] && (now - lastCacheTime) < CACHE_TTL) {
    return agentConfigCache[cacheKey]!
  }

  // 从数据库加载
  const agent = await prisma.agentProfile.findFirst({
    where: { type: agentType }
  })

  if (!agent || !agent.basePrompt) {
    // 返回默认值
    const defaults: Record<string, { basePrompt: string; name: string }> = {
      SECRETARY: {
        basePrompt: `你是用户的智能秘书（Secretary），负责：
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
- 用中文回复用户`,
        name: '智能秘书'
      },
      WORKER: {
        basePrompt: `你是一个专业的任务执行专家（Worker）。你的职责是根据用户需求执行具体任务。

工作要求：
1. 仔细分析任务需求
2. 制定执行计划
3. 逐步执行并记录过程
4. 产出可交付的结果

输出格式要求：
- 清晰的结构化输出
- 包含执行步骤和结果
- 如遇问题，说明原因和建议`,
        name: '任务执行者'
      }
    }
    return defaults[agentType]
  }

  // 更新缓存
  agentConfigCache[cacheKey] = {
    basePrompt: agent.basePrompt,
    name: agent.name
  }
  lastCacheTime = now

  return { basePrompt: agent.basePrompt, name: agent.name }
}

/**
 * 清除 Agent 配置缓存（用于配置更新后刷新）
 */
export async function clearAgentConfigCache() {
  agentConfigCache = { secretary: null, worker: null, manager: null }
  lastCacheTime = 0
}

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
  content: string,
  attachmentIds: string[] = []
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

  // 3. 如果有附件，先读取附件内容
  let attachmentContents: string[] = []
  console.log(`[Secretary] Processing message with ${attachmentIds.length} attachments:`, attachmentIds)

  if (attachmentIds.length > 0) {
    for (const attachmentId of attachmentIds) {
      console.log(`[Secretary] Reading attachment: ${attachmentId}`)
      const fileContent = await readFileById(attachmentId)
      console.log(`[Secretary] Attachment content length: ${fileContent.length} chars`)
      attachmentContents.push(fileContent)
      // 记录附件读取
      await prisma.contextHistory.create({
        data: {
          sessionId,
          agentId: 'SECRETARY',
          action: 'read_attachment',
          input: attachmentId,
          output: fileContent.slice(0, 500) // 限制记录长度
        }
      })
    }
  }

  if (attachmentContents.length === 0 && attachmentIds.length > 0) {
    console.warn(`[Secretary] WARNING: ${attachmentIds.length} attachment IDs provided but no content was read!`)
  }

  // 4. 构建上下文（包含附件内容）
  let fullContent = content
  if (attachmentContents.length > 0) {
    fullContent = `${content}\n\n--- 附件内容 ---\n${attachmentContents.join('\n\n---\n')}`
  }

  // 5. 记录上下文
  await prisma.contextHistory.create({
    data: {
      sessionId,
      agentId: 'SECRETARY',
      action: 'analyze_input',
      input: fullContent,
      output: JSON.stringify({ classification: analysis.classification, complexity: analysis.complexity, attachments: attachmentIds })
    }
  })

  // 6. 根据分类类型处理
  let responseContent: string

  switch (analysis.classification.type) {
    case 'QUESTION':
      responseContent = await handleQuestion(fullContent, attachmentIds)
      break
    case 'REQUIREMENT':
      // 检查需求是否清晰，清晰时直接执行
      if (checkRequirementClarity(content)) {
        // 需求清晰，直接执行
        await handleExecution(fullContent, analysis, sessionId, userMessageId, attachmentIds)
        responseContent = `【需求已确认，开始执行】\n\n任务：${content}\n\n复杂度：${analysis.complexity.level}\n\n正在执行中，请稍候...`
      } else {
        // 需求不清晰，询问具体内容
        responseContent = await handleRequirement(fullContent, analysis, attachmentIds)
      }
      break
    case 'EXECUTION':
      responseContent = await handleExecution(fullContent, analysis, sessionId, userMessageId, attachmentIds)
      break
    default:
      responseContent = await handleDirect(fullContent)
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
async function handleQuestion(content: string, attachmentIds: string[] = []): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'user', content }
  ]

  try {
    const config = await loadAgentConfig('SECRETARY')
    const response = await generateCompletion(
      messages,
      config.basePrompt
    )
    return response.content
  } catch (error) {
    console.error('Error handling question:', error)
    return `您的问题是："${content}"

我正在思考如何回答您的问题，请稍等...`
  }
}

/**
 * 处理需求类请求 - 需求清晰时直接执行，不追问
 */
async function handleRequirement(
  content: string,
  analysis: { classification: InputClassification; complexity: ComplexityAssessment },
  attachmentIds: string[] = []
): Promise<string> {
  // 需求清晰度判断：如果用户明确说明了要做什么（有具体目标），就直接执行
  const isClearRequirement = checkRequirementClarity(content)

  if (isClearRequirement) {
    // 需求清晰，直接执行任务（调用 handleExecution 的逻辑）
    // 这里我们返回一个提示，让系统继续处理
    return `【需求已确认，开始执行】\n\n任务：${content}\n\n复杂度：${analysis.complexity.level}\n\n正在执行中...`
  } else {
    // 需求不清晰，询问具体内容
    const messages: LLMMessage[] = [
      { role: 'user', content: `用户需求：${content}\n\n请告诉我您具体想要做什么？` }
    ]

    try {
      const config = await loadAgentConfig('SECRETARY')
      const response = await generateCompletion(
        messages,
        config.basePrompt
      )
      return response.content
    } catch (error) {
      console.error('Error handling requirement:', error)
      return `请告诉我您具体想要做什么？例如：您希望我帮您实现什么功能？`
    }
  }
}

/**
 * 检查需求是否清晰
 * 清晰需求：用户明确说明要做什么、有具体目标
 */
function checkRequirementClarity(content: string): boolean {
  const clearIndicators = [
    '帮我', '帮我写', '帮我创建', '帮我开发', '帮我实现',
    '我要', '需要你', '请帮我',
    '生成', '创建', '开发', '实现', '编写',
    '分析', '处理', '转换', '优化',
    '写一个', '做一个', '开发一个', '实现一个'
  ]

  const unclearIndicators = [
    '怎么办', '怎么处理', '怎么写', '怎么实现',
    '有什么', '哪个好', '哪个更'
  ]

  // 如果有不清晰指标的询问，可能是问问题而非需求
  for (const indicator of unclearIndicators) {
    if (content.includes(indicator)) {
      return false
    }
  }

  // 如果有清晰需求指示，说明是明确的需求
  for (const indicator of clearIndicators) {
    if (content.includes(indicator)) {
      return true
    }
  }

  // 默认视为需求清晰，直接处理（让 LLM 判断如何处理）
  return true
}

/**
 * 处理执行类请求 - 创建任务并调度 Worker
 * 核心原则：需求分析和任务规划完全交给 Agent 处理
 */
async function handleExecution(
  content: string,
  analysis: { classification: InputClassification; complexity: ComplexityAssessment },
  sessionId: string,
  messageId: string,
  attachmentIds: string[] = []
): Promise<string> {
  // 1. 先让 Agent 分析任务复杂度（完全由 LLM 判断，不使用工程规则）
  const complexityAnalysis = await analyzeTaskComplexity(content, attachmentIds)

  // 2. 如果是复杂任务，先进行任务规划
  if (complexityAnalysis.needsPlanning) {
    return await handleComplexTask(content, analysis, sessionId, messageId, attachmentIds, complexityAnalysis)
  }

  // 3. 简单/中等复杂度任务，直接创建并执行
  const task = await prisma.task.create({
    data: {
      sessionId,
      messageId,
      taskName: extractTaskName(content),
      description: content,
      status: 'PENDING',
      complexity: complexityAnalysis.estimatedComplexity as any,
      priority: complexityAnalysis.estimatedComplexity === 'COMPLEX' ? 'HIGH' : 'MEDIUM'
    }
  })

  // 广播任务创建
  io.to(`session:${sessionId}`).emit('task_created', {
    taskId: task.id,
    taskName: task.taskName,
    status: task.status,
    priority: task.priority
  })

  const initialMessage = `好的，我已收到您的任务需求，正在开始执行...\n\n📋 **任务**：${task.taskName}\n📊 **复杂度**：${complexityAnalysis.estimatedComplexity}\n🔄 **状态**：等待执行中`

  // 异步开始任务执行
  executeTask(task.id, content, sessionId, attachmentIds).catch(err => {
    console.error('Task execution error:', err)
  })

  return initialMessage
}

/**
 * 让 Agent 分析任务复杂度（完全由 LLM 判断）
 */
interface ComplexityAnalysis {
  estimatedComplexity: 'SIMPLE' | 'MEDIUM' | 'COMPLEX'
  needsPlanning: boolean
  reasoning: string
}

async function analyzeTaskComplexity(content: string, attachmentIds: string[]): Promise<ComplexityAnalysis> {
  // 读取附件内容
  let attachmentInfo = ''
  if (attachmentIds.length > 0) {
    const contents = await Promise.all(attachmentIds.map(id => readFileById(id).catch(() => '')))
    const nonEmpty = contents.filter(c => c.length > 0)
    if (nonEmpty.length > 0) {
      attachmentInfo = `\n\n用户上传了 ${attachmentIds.length} 个附件，内容摘要：${nonEmpty.slice(0, 500).join('...')}...`
    }
  }

  const prompt = `请分析以下任务的复杂度，并判断是否需要进行任务规划分解。

任务内容：${content}${attachmentInfo}

分析要求：
1. 评估任务复杂度（SIMPLE/MEDIUM/COMPLEX）
2. 判断是否需要将任务分解为多个子任务
3. 解释你的判断理由

输出格式（JSON）：
{
  "estimatedComplexity": "SIMPLE|MEDIUM|COMPLEX",
  "needsPlanning": true或false,
  "reasoning": "判断理由"
}

请直接输出 JSON，不要有其他内容。`

  try {
    const response = await generateCompletion(
      [{ role: 'user', content: prompt }],
      '你是一个任务分析专家，负责评估任务复杂度。'
    )

    // 解析 JSON 响应
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return {
        estimatedComplexity: result.estimatedComplexity || 'MEDIUM',
        needsPlanning: result.needsPlanning || false,
        reasoning: result.reasoning || ''
      }
    }
  } catch (error) {
    console.error('Error analyzing task complexity:', error)
  }

  // 默认返回中等复杂度，不规划
  return {
    estimatedComplexity: 'MEDIUM',
    needsPlanning: false,
    reasoning: 'LLM 分析失败，使用默认判断'
  }
}

/**
 * 处理复杂任务 - 任务规划分解 + 多 Agent 执行
 */
async function handleComplexTask(
  content: string,
  analysis: { classification: InputClassification; complexity: ComplexityAssessment },
  sessionId: string,
  messageId: string,
  attachmentIds: string[],
  complexityAnalysis: ComplexityAnalysis
): Promise<string> {
  // 1. 创建主任务
  const mainTask = await prisma.task.create({
    data: {
      sessionId,
      messageId,
      taskName: extractTaskName(content),
      description: content,
      status: 'PENDING',
      complexity: 'COMPLEX',
      priority: 'HIGH'
    }
  })

  // 广播主任务创建
  io.to(`session:${sessionId}`).emit('task_created', {
    taskId: mainTask.id,
    taskName: mainTask.taskName,
    status: mainTask.status,
    priority: mainTask.priority
  })

  // 2. 通知用户正在分析规划
  const planningMessage = `收到复杂任务，正在分析规划中...\n\n📋 **任务**：${mainTask.taskName}\n🔍 **复杂度**：${complexityAnalysis.estimatedComplexity}\n💡 **分析**：${complexityAnalysis.reasoning}\n\n请稍候，我将制定执行计划...`

  // 3. 异步进行任务规划（不阻塞响应）
  planAndExecuteSubtasks(mainTask.id, content, sessionId, attachmentIds, complexityAnalysis).catch(err => {
    console.error('Task planning error:', err)
  })

  return planningMessage
}

/**
 * 任务规划与执行 - 分解子任务并调度执行
 */
async function planAndExecuteSubtasks(
  mainTaskId: string,
  content: string,
  sessionId: string,
  attachmentIds: string[],
  complexityAnalysis: ComplexityAnalysis
) {
  try {
    // 更新任务状态为分析中
    await prisma.task.update({
      where: { id: mainTaskId },
      data: { status: 'IN_PROGRESS' }
    })

    io.to(`session:${sessionId}`).emit('task_progress', {
      taskId: mainTaskId,
      progress: 10,
      status: 'planning',
      message: '正在分析任务并制定执行计划...'
    })

    // 1. 读取附件内容
    let attachmentContents: string[] = []
    if (attachmentIds.length > 0) {
      attachmentContents = await Promise.all(
        attachmentIds.map(id => readFileById(id).catch(() => ''))
      )
    }

    let fullContent = content
    if (attachmentContents.length > 0) {
      fullContent = `${content}\n\n--- 用户上传的附件内容 ---\n${attachmentContents.join('\n\n---\n')}`
    }

    // 2. 让 Agent 进行任务分解（使用 Secretary 的 basePrompt 从数据库加载）
    const planningPrompt = `你是任务规划专家。请将以下复杂需求分解为多个可执行的子任务。

需求内容：${fullContent}

要求：
1. 仔细分析需求，确定需要完成的步骤
2. 每个子任务应该是独立的、可执行的
3. 考虑任务之间的依赖关系
4. 确定执行顺序

输出格式（JSON 数组，每个元素是一个子任务）：
[
  {
    "name": "子任务名称（简洁）",
    "description": "具体描述，说明要做什么",
    "order": 执行顺序数字,
    "complexity": "SIMPLE|MEDIUM|COMPLEX"
  }
]

请直接输出 JSON 数组，不要有其他内容。如果不需要分解，返回空数组 []。`

    // 从数据库加载 Secretary 配置
    const secretaryConfig = await loadAgentConfig('SECRETARY')

    io.to(`session:${sessionId}`).emit('task_progress', {
      taskId: mainTaskId,
      progress: 30,
      status: 'planning',
      message: '正在分解任务步骤...'
    })

    const response = await generateCompletion(
      [{ role: 'user', content: planningPrompt }],
      secretaryConfig.basePrompt  // 使用数据库加载的 Secretary prompt
    )

    // 3. 解析子任务
    let subtasks: any[] = []
    try {
      const jsonMatch = response.content.match(/[\s\S]*\[.*\]/s)
      if (jsonMatch) {
        // 尝试提取 JSON 数组
        const arrayMatch = response.content.match(/\[[\s\S]*\]/m)
        if (arrayMatch) {
          subtasks = JSON.parse(arrayMatch[0])
        }
      }
    } catch (parseError) {
      console.error('Failed to parse subtasks:', parseError)
    }

    // 4. 如果没有分解出子任务，直接执行主任务
    if (!subtasks || subtasks.length === 0) {
      console.log('[TaskPlanner] No subtasks parsed, executing as single task')
      await executeMainTask(mainTaskId, content, sessionId, attachmentContents)
      return
    }

    // 5. 创建子任务到数据库
    io.to(`session:${sessionId}`).emit('task_progress', {
      taskId: mainTaskId,
      progress: 50,
      status: 'planning',
      message: `已分解为 ${subtasks.length} 个子任务，正在创建...`
    })

    const createdSubtasks = await Promise.all(
      subtasks.map((st: any) =>
        prisma.task.create({
          data: {
            sessionId,
            parentTaskId: mainTaskId,
            taskName: st.name || '子任务',
            description: st.description || '',
            status: 'PENDING',
            complexity: (st.complexity || 'MEDIUM') as any,
            priority: st.complexity === 'COMPLEX' ? 'HIGH' : 'MEDIUM'
          }
        })
      )
    )

    // 广播子任务创建
    for (const subtask of createdSubtasks) {
      io.to(`session:${sessionId}`).emit('task_created', {
        taskId: subtask.id,
        taskName: subtask.taskName,
        status: subtask.status,
        priority: subtask.priority,
        parentTaskId: mainTaskId
      })
    }

    // 6. 按顺序执行子任务
    // 按 order 排序
    createdSubtasks.sort((a, b) => {
      const stA = subtasks.find((s: any) => s.name === a.taskName)
      const stB = subtasks.find((s: any) => s.name === b.taskName)
      return (stA?.order || 0) - (stB?.order || 0)
    })

    const totalSubtasks = createdSubtasks.length
    let completedSubtasks = 0

    // 执行所有子任务
    const executionPromises = createdSubtasks.map(async (subtask, index) => {
      const st = subtasks.find((s: any) => s.name === subtask.taskName)

      // 查找依赖的子任务是否完成（简化版：按顺序执行）
      const progress = 50 + Math.floor((index / totalSubtasks) * 40)

      io.to(`session:${sessionId}`).emit('task_progress', {
        taskId: mainTaskId,
        progress,
        status: 'executing',
        message: `正在执行子任务 ${index + 1}/${totalSubtasks}: ${subtask.taskName}`,
        currentSubtask: subtask.taskName
      })

      // 执行子任务
      const result = await executeSubtask(
        subtask.id,
        st?.description || subtask.description || content,
        sessionId,
        attachmentIds,
        index
      )

      completedSubtasks++

      return result
    })

    // 等待所有子任务完成
    const results = await Promise.all(executionPromises)

    // 7. 汇总结果
    const finalResult = results.join('\n\n---\n\n')

    // 更新主任务完成
    await prisma.task.update({
      where: { id: mainTaskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result: finalResult
      }
    })

    // 创建工作产物
    await prisma.workProduct.create({
      data: {
        taskId: mainTaskId,
        name: '执行结果汇总',
        type: 'TEXT',
        content: finalResult
      }
    })

    // 广播任务完成
    io.to(`session:${sessionId}`).emit('task_completed', {
      taskId: mainTaskId,
      status: 'COMPLETED',
      result: finalResult,
      progress: 100,
      subtasksCount: totalSubtasks
    })

    // 通知用户
    const workerMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'WORKER',
        content: `✅ **任务已完成**（共 ${totalSubtasks} 个子任务）\n\n${finalResult}`,
        inputType: 'EXECUTION'
      }
    })

    io.to(`session:${sessionId}`).emit('new_message', workerMessage)

  } catch (error: any) {
    console.error('Task planning and execution error:', error)

    await prisma.task.update({
      where: { id: mainTaskId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message || '任务执行失败'
      }
    })

    io.to(`session:${sessionId}`).emit('task_update', {
      taskId: mainTaskId,
      status: 'FAILED',
      error: error.message
    })
  }
}

/**
 * 执行单个子任务
 */
async function executeSubtask(
  subtaskId: string,
  content: string,
  sessionId: string,
  attachmentIds: string[],
  index: number
): Promise<string> {
  // 更新子任务状态
  await prisma.task.update({
    where: { id: subtaskId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      assignedAgentId: 'WORKER'
    }
  })

  // 读取附件
  let attachmentContents: string[] = []
  if (attachmentIds.length > 0) {
    attachmentContents = await Promise.all(
      attachmentIds.map(id => readFileById(id).catch(() => ''))
    )
  }

  let fullContent = content
  if (attachmentContents.length > 0) {
    fullContent = `${content}\n\n--- 参考附件 ---\n${attachmentContents.join('\n\n---\n')}`
  }

  try {
    // 执行任务
    const workerConfig = await loadAgentConfig('WORKER')
    let result = ''

    for await (const chunk of generateCompletionStream(
      [{ role: 'user', content: EXECUTION_TEMPLATE.replace('{taskDescription}', fullContent) }],
      workerConfig.basePrompt
    )) {
      result += chunk
    }

    // 更新子任务完成
    await prisma.task.update({
      where: { id: subtaskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result
      }
    })

    // 记录执行历史
    await prisma.contextHistory.create({
      data: {
        sessionId,
        taskId: subtaskId,
        agentId: 'WORKER',
        action: 'subtask_completed',
        input: content,
        output: result.slice(0, 500)
      }
    })

    return result

  } catch (error: any) {
    // 子任务失败
    await prisma.task.update({
      where: { id: subtaskId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message
      }
    })

    return `子任务执行失败: ${error.message}`
  }
}

/**
 * 执行主任务（当不需要分解时）
 */
async function executeMainTask(
  taskId: string,
  content: string,
  sessionId: string,
  attachmentContents: string[]
) {
  // 更新任务状态
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      assignedAgentId: 'WORKER'
    }
  })

  io.to(`session:${sessionId}`).emit('task_progress', {
    taskId,
    progress: 20,
    status: 'executing',
    message: '正在执行任务...'
  })

  try {
    let fullContent = content
    if (attachmentContents.length > 0) {
      fullContent = `${content}\n\n--- 用户上传的附件 ---\n${attachmentContents.join('\n\n---\n')}`
    }

    const workerConfig = await loadAgentConfig('WORKER')
    let result = ''

    for await (const chunk of generateCompletionStream(
      [{ role: 'user', content: EXECUTION_TEMPLATE.replace('{taskDescription}', fullContent) }],
      workerConfig.basePrompt
    )) {
      result += chunk
    }

    // 完成任务
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        result
      }
    })

    io.to(`session:${sessionId}`).emit('task_completed', {
      taskId,
      status: 'COMPLETED',
      result,
      progress: 100
    })

    const workerMessage = await prisma.message.create({
      data: {
        sessionId,
        role: 'WORKER',
        content: `✅ **任务已完成**\n\n${result}`,
        inputType: 'EXECUTION'
      }
    })

    io.to(`session:${sessionId}`).emit('new_message', workerMessage)

  } catch (error: any) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message
      }
    })

    io.to(`session:${sessionId}`).emit('task_update', {
      taskId,
      status: 'FAILED',
      error: error.message
    })
  }
}

/**
 * 直接处理（非分类的请求）
 */
async function handleDirect(content: string): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'user', content }
  ]

  try {
    const config = await loadAgentConfig('SECRETARY')
    const response = await generateCompletion(
      messages,
      config.basePrompt
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
async function executeTask(taskId: string, content: string, sessionId: string, attachmentIds: string[] = []) {
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

  // 3. 读取附件内容（如果有）
  let attachmentContents: string[] = []
  if (attachmentIds.length > 0) {
    for (const attachmentId of attachmentIds) {
      const fileContent = await readFileById(attachmentId)
      attachmentContents.push(fileContent)
    }
  }

  // 4. 记录开始执行
  await prisma.contextHistory.create({
    data: {
      sessionId,
      taskId,
      agentId: 'WORKER',
      action: 'task_started',
      input: content,
      output: 'Worker 开始执行任务，附件数量: ' + attachmentIds.length
    }
  })

  try {
    // 5. 构建 Worker 执行提示（包含附件内容）
    let fullContent = content
    if (attachmentContents.length > 0) {
      fullContent = `${content}\n\n--- 用户上传的附件内容 ---\n${attachmentContents.join('\n\n---\n')}`
    }

    const workerMessages: LLMMessage[] = [
      {
        role: 'user',
        content: EXECUTION_TEMPLATE.replace('{taskDescription}', fullContent)
      }
    ]

    // 6. 流式执行并收集结果
    let fullResult = ''
    let progress = 20

    // 发送进度更新
    io.to(`session:${sessionId}`).emit('task_progress', {
      taskId,
      progress,
      status: 'executing',
      message: '正在分析任务需求和附件...'
    })

    // 调用 LLM 执行
    const workerConfig = await loadAgentConfig('WORKER')
    for await (const chunk of generateCompletionStream(
      workerMessages,
      workerConfig.basePrompt
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

    // 7. 创建工作产物
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