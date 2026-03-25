import Anthropic from '@anthropic-ai/sdk'

// 初始化 Anthropic 客户端
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || '',
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined
})

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export interface LLMResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  toolCalls?: Array<{
    name: string
    input: Record<string, any>
  }>
}

/**
 * 调用 LLM 生成回复
 */
export async function generateCompletion(
  messages: LLMMessage[],
  systemPrompt?: string,
  model: string = 'claude-sonnet-4-20250514',
  maxTokens: number = 4096
): Promise<LLMResponse> {
  try {
    const allMessages: { role: 'user' | 'assistant'; content: string }[] = []

    // 如果有 system prompt，将其作为 user 消息的第一条
    if (systemPrompt) {
      allMessages.push({ role: 'user', content: systemPrompt })
    }

    // 添加其他消息
    allMessages.push(...messages)

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: allMessages,
      temperature: 0.7
    })

    const content = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    }
  } catch (error) {
    console.error('LLM API Error:', error)
    throw error
  }
}

/**
 * 流式调用 LLM
 */
export async function* generateCompletionStream(
  messages: LLMMessage[],
  systemPrompt?: string,
  model: string = 'claude-sonnet-4-20250514',
  maxTokens: number = 4096
): AsyncGenerator<string, void, unknown> {
  try {
    const allMessages: { role: 'user' | 'assistant'; content: string }[] = []

    // 如果有 system prompt，将其作为 user 消息的第一条
    if (systemPrompt) {
      allMessages.push({ role: 'user', content: systemPrompt })
    }

    // 添加其他消息
    allMessages.push(...messages)

    const stream = await anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      messages: allMessages,
      temperature: 0.7
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text
      }
    }
  } catch (error) {
    console.error('LLM Stream Error:', error)
    throw error
  }
}

export default anthropic