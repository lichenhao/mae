import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 创建默认 Secretary Agent - 移除角色身份，专注工作方式
  const secretary = await prisma.agentProfile.upsert({
    where: { code: 'SECRETARY' },
    update: { name: '需求处理器' },
    create: {
      code: 'SECRETARY',
      name: '需求处理器',
      description: '处理用户输入，分类任务，调度执行',
      type: 'SECRETARY',
      basePrompt: `## 工作方式
当接收到用户消息时，按以下流程处理：

1. **需求判断**
   - 清晰需求：用户明确说明要做什么、有具体目标（如"帮我写一个函数"、"分析这个文件"）
   - 模糊需求：缺少关键信息，无法直接执行（如"帮我处理"但没说处理什么）

2. **分类处理**
   - 问题类：用户询问信息，直接回答
   - 需求类：用户要求执行任务，评估后直接执行
   - 执行类：用户明确要求执行，创建任务并开始

3. **关键规则**
   - 需求清晰时 → 直接执行，不追问
   - 需求模糊时 → 询问具体内容
   - 有附件+具体指令 → 直接处理附件
   - 复杂任务 → 分析复杂度，分解为子任务，调度执行，监督结果

4. **禁止行为**
   - 用户说"帮我写一个函数"时，不要问"用什么语言"
   - 用户说"分析这个文件"并上传了文件，不要问"分析什么"
   - 需求已经明确时不要重复确认
   - 不要在代码中硬编码判断逻辑，必须由我根据任务内容自主分析

5. **任务规划与执行（核心职责）**
   当判断任务需要分解时：
   a) 分析任务复杂度，理解最终目标
   b) 将任务分解为多个可执行的子任务
   c) 确定每个子任务的执行顺序和依赖关系
   d) 创建子任务到系统
   e) 调度 Worker 执行子任务
   f) 监督执行进度，处理异常
   g) 汇总子任务结果，返回给用户

6. **产出标准**
   - 问题类：直接给出答案
   - 需求类：执行任务并返回结果
   - 执行类：创建任务，开始执行，通知用户
   - 复杂任务：分解为子任务，调度执行，汇总结果`
    }
  })
  console.log('Created Secretary Agent:', secretary.name)

  // 创建默认 Worker Agent - 移除角色身份，专注工作方式
  const worker = await prisma.agentProfile.upsert({
    where: { code: 'WORKER' },
    update: { name: '任务执行器' },
    create: {
      code: 'WORKER',
      name: '任务执行器',
      description: '执行具体的任务，如代码编写、数据分析、文档处理',
      type: 'WORKER',
      basePrompt: `## 工作方式
根据用户需求执行任务：

1. **任务分析**
   - 理解用户要什么结果
   - 确定需要使用的工具和技能

2. **执行流程**
   - 制定执行计划
   - 按步骤执行
   - 记录执行过程
   - 产出可交付结果

3. **工具使用**
   - 需要读取文件时使用 code_reader
   - 需要执行代码时使用 code_executor
   - 需要生成文档时使用 document_writer

4. **产出标准**
   - 结构化输出
   - 包含执行步骤和结果
   - 如有问题，说明原因和建议

5. **异常处理**
   - 执行失败时记录错误
   - 提供重试建议
   - 及时通知用户`
    }
  })
  console.log('Created Worker Agent:', worker.name)

  // 创建默认 Manager Agent - 移除角色身份
  const manager = await prisma.agentProfile.upsert({
    where: { code: 'MANAGER' },
    update: { name: '任务协调器' },
    create: {
      code: 'MANAGER',
      name: '任务协调器',
      description: '协调多个任务，管理进度和质量',
      type: 'MANAGER',
      basePrompt: `## 工作方式
协调和管理任务执行：

1. **任务分解**
   - 分析复杂任务
   - 分解为可执行的子任务
   - 确定依赖关系

2. **进度管理**
   - 跟踪任务进度
   - 检测异常情况
   - 处理超时和失败

3. **质量把控**
   - 验证任务产出
   - 确保符合要求
   - 记录执行情况

4. **产出标准**
   - 清晰的任务状态报告
   - 进度和问题及时通知`
    }
  })
  console.log('Created Manager Agent:', manager.name)

  // 创建基础 Skills - 包含完整的工作流程和工具规范
  const skills = [
    {
      code: 'code_reader',
      name: '代码读取',
      description: '读取和分析代码文件，支持多种编程语言',
      config: {
        workflow: [
          '1. 接收文件路径或附件ID',
          '2. 验证文件存在且可读',
          '3. 读取文件内容',
          '4. 识别编程语言',
          '5. 提取关键信息（函数、类、依赖）'
        ],
        triggerConditions: ['用户要求分析代码', '用户上传代码文件', '需要读取现有代码'],
        tools: ['read_file'],
        inputStandard: {
          required: ['filePath 或 attachmentId'],
          optional: ['maxLines', 'encoding']
        },
        rejectConditions: ['文件不存在', '文件超过10MB', '二进制文件无法解析'],
        outputFormat: '结构化的代码分析报告'
      }
    },
    {
      code: 'file_analyzer',
      name: '文件分析',
      description: '分析文件内容，提取关键信息',
      config: {
        workflow: [
          '1. 接收文件内容或附件ID',
          '2. 识别文件类型',
          '3. 解析内容结构',
          '4. 提取关键信息',
          '5. 生成分析报告'
        ],
        triggerConditions: ['用户要求分析文件', '用户上传文档'],
        tools: ['read_file', 'parse_content'],
        inputStandard: {
          required: ['filePath 或 attachmentId'],
          optional: ['analysisType']
        },
        rejectConditions: ['文件不存在', '无法解析的文件格式'],
        outputFormat: '文件分析报告'
      }
    },
    {
      code: 'web_search',
      name: '网络搜索',
      description: '搜索互联网获取相关信息',
      config: {
        workflow: [
          '1. 解析搜索需求',
          '2. 执行搜索',
          '3. 筛选结果',
          '4. 整理信息返回'
        ],
        triggerConditions: ['用户询问信息', '需要最新知识'],
        tools: ['search_web'],
        inputStandard: {
          required: ['searchQuery'],
          optional: ['maxResults']
        },
        rejectConditions: ['搜索词为空', '搜索超时'],
        outputFormat: '搜索结果列表'
      }
    },
    {
      code: 'code_executor',
      name: '代码执行',
      description: '执行代码并返回结果',
      config: {
        workflow: [
          '1. 接收代码和语言类型',
          '2. 验证代码安全性',
          '3. 在沙箱中执行',
          '4. 收集输出结果',
          '5. 返回执行结果'
        ],
        triggerConditions: ['用户要求执行代码', '需要验证代码正确性'],
        tools: ['execute_code'],
        inputStandard: {
          required: ['code', 'language'],
          optional: ['timeout']
        },
        rejectConditions: ['不支持的语言', '代码包含危险操作', '执行超时'],
        outputFormat: '执行结果和输出'
      }
    },
    {
      code: 'document_writer',
      name: '文档编写',
      description: '生成各类文档和报告',
      config: {
        workflow: [
          '1. 接收文档需求',
          '2. 确定文档结构',
          '3. 生成内容',
          '4. 格式化输出'
        ],
        triggerConditions: ['用户要求生成文档', '需要输出报告'],
        tools: ['generate_document'],
        inputStandard: {
          required: ['content', 'format'],
          optional: ['template', 'style']
        },
        rejectConditions: ['格式不支持', '内容为空'],
        outputFormat: '格式化文档'
      }
    },
    // 新增：任务跟踪 Skill
    {
      code: 'task_tracker',
      name: '任务跟踪',
      description: '监督任务执行进度，检测异常并处理',
      config: {
        workflow: [
          '1. 接收任务ID和检查点配置',
          '2. 查询任务当前状态',
          '3. 记录进度到数据库',
          '4. 检测超时或失败',
          '5. 触发重试或通知用户'
        ],
        triggerConditions: ['任务状态变为IN_PROGRESS', '用户请求查看任务进度', '定时检查（每30秒）'],
        tools: ['query_task_status', 'update_task_progress', 'notify_user'],
        inputStandard: {
          required: ['taskId'],
          optional: ['checkInterval', 'timeout', 'maxRetries']
        },
        rejectConditions: ['任务不存在', '任务已取消', '任务已完成'],
        outputFormat: '进度报告或异常处理结果'
      }
    },
    // 新增：任务规划 Skill
    {
      code: 'task_planner',
      name: '任务规划',
      description: '将复杂需求分解为可执行的任务步骤',
      config: {
        workflow: [
          '1. 分析用户需求',
          '2. 识别任务依赖关系',
          '3. 分解为子任务',
          '4. 创建任务到数据库',
          '5. 设置任务执行顺序'
        ],
        triggerConditions: ['用户请求执行复杂任务', '任务复杂度为COMPLEX'],
        tools: ['create_subtask', 'query_task_dependencies', 'schedule_task'],
        inputStandard: {
          required: ['taskDescription', 'complexity'],
          optional: ['parentTaskId']
        },
        rejectConditions: ['需求完全不明确无法分解', '缺少必要信息'],
        outputFormat: '任务分解计划 + 子任务列表'
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

  // 绑定 task_tracker 技能给 Worker（任务执行时自动跟踪）
  const taskTrackerSkill = await prisma.skillProfile.findUnique({ where: { code: 'task_tracker' } })
  if (taskTrackerSkill) {
    await prisma.agentSkillBinding.upsert({
      where: {
        agentId_skillId: {
          agentId: worker.id,
          skillId: taskTrackerSkill.id
        }
      },
      update: {},
      create: {
        agentId: worker.id,
        skillId: taskTrackerSkill.id,
        priority: 6
      }
    })
  }

  // 绑定 task_planner 技能给 Manager（复杂任务规划）
  const taskPlannerSkill = await prisma.skillProfile.findUnique({ where: { code: 'task_planner' } })
  if (taskPlannerSkill) {
    await prisma.agentSkillBinding.upsert({
      where: {
        agentId_skillId: {
          agentId: manager.id,
          skillId: taskPlannerSkill.id
        }
      },
      update: {},
      create: {
        agentId: manager.id,
        skillId: taskPlannerSkill.id,
        priority: 10
      }
    })
  }

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