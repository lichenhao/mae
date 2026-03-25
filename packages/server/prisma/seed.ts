import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 创建默认 Secretary Agent
  const secretary = await prisma.agentProfile.upsert({
    where: { code: 'SECRETARY' },
    update: {},
    create: {
      code: 'SECRETARY',
      name: '智能秘书',
      description: '负责理解用户意图、分类任务、调度Worker执行任务',
      type: 'SECRETARY',
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
- 用中文回复用户`
    }
  })
  console.log('Created Secretary Agent:', secretary.name)

  // 创建默认 Worker Agent
  const worker = await prisma.agentProfile.upsert({
    where: { code: 'WORKER' },
    update: {},
    create: {
      code: 'WORKER',
      name: '任务执行者',
      description: '负责执行具体的任务，如代码编写、数据分析、文档处理等',
      type: 'WORKER',
      basePrompt: `你是一个专业的任务执行专家（Worker）。你的职责是根据用户需求执行具体任务。

工作要求：
1. 仔细分析任务需求
2. 制定执行计划
3. 逐步执行并记录过程
4. 产出可交付的结果

输出格式要求：
- 清晰的结构化输出
- 包含执行步骤和结果
- 如遇问题，说明原因和建议`
    }
  })
  console.log('Created Worker Agent:', worker.name)

  // 创建默认 Manager Agent
  const manager = await prisma.agentProfile.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: {
      code: 'MANAGER',
      name: '项目管理者',
      description: '负责协调多个Agent工作，管理项目进度和质量',
      type: 'MANAGER',
      basePrompt: `你是一个项目管理者（Manager），负责协调多个Agent完成复杂任务。

职责：
1. 任务分解与分配
2. 进度跟踪与协调
3. 质量把控
4. 风险识别与应对

工作方式：
- 分析任务需求
- 制定执行计划
- 分配给合适的Agent
- 汇总结果并反馈`
    }
  })
  console.log('Created Manager Agent:', manager.name)

  // 创建基础 Skills
  const skills = [
    {
      code: 'code_reader',
      name: '代码读取',
      description: '读取和分析代码文件，支持多种编程语言',
      config: {
        supportedLanguages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
        maxFileSize: 1048576 // 1MB
      }
    },
    {
      code: 'file_analyzer',
      name: '文件分析',
      description: '分析文件内容，提取关键信息',
      config: {
        supportedTypes: ['text', 'markdown', 'json', 'xml', 'csv']
      }
    },
    {
      code: 'web_search',
      name: '网络搜索',
      description: '搜索互联网获取相关信息',
      config: {
        maxResults: 10,
        timeout: 30000
      }
    },
    {
      code: 'code_executor',
      name: '代码执行',
      description: '执行代码并返回结果',
      config: {
        allowedLanguages: ['javascript', 'python', 'bash'],
        maxExecutionTime: 30000
      }
    },
    {
      code: 'document_writer',
      name: '文档编写',
      description: '生成各类文档和报告',
      config: {
        formats: ['markdown', 'html', 'pdf']
      }
    }
  ]

  for (const skill of skills) {
    const created = await prisma.skillProfile.upsert({
      where: { code: skill.code },
      update: {},
      create: skill
    })
    console.log('Created Skill:', created.name)
  }

  // 绑定 Secretary 的初始 Skills
  await prisma.agentSkillBinding.upsert({
    where: {
      agentId_skillId: {
        agentId: secretary.id,
        skillId: (await prisma.skillProfile.findUnique({ where: { code: 'code_reader' } }))!.id
      }
    },
    update: {},
    create: {
      agentId: secretary.id,
      skillId: (await prisma.skillProfile.findUnique({ where: { code: 'code_reader' } }))!.id,
      priority: 10
    }
  })

  await prisma.agentSkillBinding.upsert({
    where: {
      agentId_skillId: {
        agentId: secretary.id,
        skillId: (await prisma.skillProfile.findUnique({ where: { code: 'file_analyzer' } }))!.id
      }
    },
    update: {},
    create: {
      agentId: secretary.id,
      skillId: (await prisma.skillProfile.findUnique({ where: { code: 'file_analyzer' } }))!.id,
      priority: 8
    }
  })

  // 绑定 Worker 的初始 Skills
  await prisma.agentSkillBinding.upsert({
    where: {
      agentId_skillId: {
        agentId: worker.id,
        skillId: (await prisma.skillProfile.findUnique({ where: { code: 'code_reader' } }))!.id
      }
    },
    update: {},
    create: {
      agentId: worker.id,
      skillId: (await prisma.skillProfile.findUnique({ where: { code: 'code_reader' } }))!.id,
      priority: 10
    }
  })

  await prisma.agentSkillBinding.upsert({
    where: {
      agentId_skillId: {
        agentId: worker.id,
        skillId: (await prisma.skillProfile.findUnique({ where: { code: 'code_executor' } }))!.id
      }
    },
    update: {},
    create: {
      agentId: worker.id,
      skillId: (await prisma.skillProfile.findUnique({ where: { code: 'code_executor' } }))!.id,
      priority: 9
    }
  })

  await prisma.agentSkillBinding.upsert({
    where: {
      agentId_skillId: {
        agentId: worker.id,
        skillId: (await prisma.skillProfile.findUnique({ where: { code: 'document_writer' } }))!.id
      }
    },
    update: {},
    create: {
      agentId: worker.id,
      skillId: (await prisma.skillProfile.findUnique({ where: { code: 'document_writer' } }))!.id,
      priority: 7
    }
  })

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })