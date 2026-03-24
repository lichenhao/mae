import { z } from 'zod'

// 输入分类结果
export interface InputClassification {
  type: 'QUESTION' | 'REQUIREMENT' | 'EXECUTION'
  confidence: number
  reasoning: string
  suggestedAction: string
}

// 任务复杂度评估结果
export interface ComplexityAssessment {
  level: 'SIMPLE' | 'MEDIUM' | 'COMPLEX'
  reasoning: string
  estimatedSteps: number
  requiresSubtasks: boolean
}

// 规则模式
const QUESTION_PATTERNS = [
  /^(什么是|如何|怎么|怎样|为什么|哪里|谁能|哪个|是否|能不能|有没有)/,
  /\?$/,
  /^请问/,
  /^帮我查/
]

const REQUIREMENT_PATTERNS = [
  /帮我/,
  /帮我做/,
  /我要/,
  /需要你/,
  /请帮我/,
  /帮我创建/,
  /帮我开发/,
  /帮我写/,
  /帮我设计/,
  /帮我实现/
]

const EXECUTION_PATTERNS = [
  /去执行/,
  /开始做/,
  /立即完成/,
  /生成/,
  /执行/,
  /^开始/
]

/**
 * 快速规则判断
 */
function quickRuleClassify(message: string): InputClassification | null {
  const text = message.trim()

  // 检查问题类
  if (QUESTION_PATTERNS.some(p => p.test(text))) {
    return {
      type: 'QUESTION',
      confidence: 0.8,
      reasoning: '疑问句式匹配',
      suggestedAction: 'search_and_answer'
    }
  }

  // 检查需求类
  if (REQUIREMENT_PATTERNS.some(p => p.test(text))) {
    return {
      type: 'REQUIREMENT',
      confidence: 0.7,
      reasoning: '需求表达匹配',
      suggestedAction: 'gather_requirements'
    }
  }

  // 检查执行类
  if (EXECUTION_PATTERNS.some(p => p.test(text))) {
    return {
      type: 'EXECUTION',
      confidence: 0.9,
      reasoning: '执行指令匹配',
      suggestedAction: 'execute_directly'
    }
  }

  return null
}

/**
 * 复杂度评估（规则版）
 */
export function assessComplexity(message: string, inputType: string): ComplexityAssessment {
  const text = message.trim()
  const length = text.length

  // 简单判断
  if (inputType === 'QUESTION') {
    // 问题类通常较简单
    return {
      level: 'SIMPLE',
      reasoning: '问题类请求，通常直接回答',
      estimatedSteps: 1,
      requiresSubtasks: false
    }
  }

  // 执行类根据长度和关键词判断
  const complexKeywords = ['系统', '网站', '应用', '平台', '完整', '全面', '多个', '复杂']
  const hasComplexKeyword = complexKeywords.some(k => text.includes(k))

  if (length > 200 || hasComplexKeyword) {
    return {
      level: 'COMPLEX',
      reasoning: '内容较长或包含复杂关键词',
      estimatedSteps: 5,
      requiresSubtasks: true
    }
  }

  if (length > 50) {
    return {
      level: 'MEDIUM',
      reasoning: '中等长度内容，可能需要多步',
      estimatedSteps: 2,
      requiresSubtasks: false
    }
  }

  return {
    level: 'SIMPLE',
    reasoning: '简短明确的请求',
    estimatedSteps: 1,
    requiresSubtasks: false
  }
}

/**
 * 分类用户输入
 */
export function classifyInput(message: string): InputClassification {
  // 1. 先用规则快速判断
  const ruleResult = quickRuleClassify(message)
  if (ruleResult) {
    return ruleResult
  }

  // 2. 规则无法确定时，根据内容特征判断
  const text = message.trim()
  const hasCodeKeyword = text.includes('代码') || text.includes('函数') || text.includes('编程')
  const hasDesignKeyword = text.includes('设计') || text.includes('界面') || text.includes('UI')
  const hasDataKeyword = text.includes('数据') || text.includes('分析') || text.includes('统计')

  if (hasCodeKeyword || hasDesignKeyword || hasDataKeyword) {
    return {
      type: 'EXECUTION',
      confidence: 0.6,
      reasoning: '包含特定领域关键词，判断为执行类',
      suggestedAction: 'execute_directly'
    }
  }

  // 3. 默认返回需求类
  return {
    type: 'REQUIREMENT',
    confidence: 0.5,
    reasoning: '无法明确分类，默认为需求类',
    suggestedAction: 'gather_requirements'
  }
}

/**
 * 完整的输入分析
 */
export interface FullAnalysis {
  classification: InputClassification
  complexity: ComplexityAssessment
}

export function analyzeInput(message: string): FullAnalysis {
  const classification = classifyInput(message)
  const complexity = assessComplexity(message, classification.type)

  return {
    classification,
    complexity
  }
}