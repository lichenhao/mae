# Multi-Agent 系统详细设计方案

## 一、整体架构概述

### 1.1 核心设计理念

本系统定位：**用户通过聊天与虚拟员工（Multi-Agent）沟通完成工作的应用**。

核心工作流程：
1. 用户 → 认证系统 → Chat 界面
2. 用户输入 + 附件 → 发送 → 创建 Session
3. Session 创建时自动分配 Secretary（数字员工秘书）
4. Secretary 分析输入 → 分类 → 调度 Worker 执行
5. 所有过程持久化到数据库 → UI 可追溯

### 1.2 技术栈

- **前端**：React + TypeScript + WebSocket
- **后端**：Node.js + Express + Prisma
- **数据库**：PostgreSQL
- **AI**：Claude API（可扩展）

---

## 二、用户认证模块

### 2.1 认证流程图

```
用户 → 登录/注册页面 → 验证 → JWT Token → 存入 LocalStorage → 重定向到 Chat 页面
```

### 2.2 数据模型

```prisma
// 用户表
model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  nickname        String?
  avatar          String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // 关联
  sessions        Session[]
  preferences     UserPreferenceModel[]
}

// 用户偏好设置
model UserPreferenceModel {
  id              String    @id @default(uuid())
  userId          String
  preferenceKey   String    // e.g., "theme", "defaultModel"
  preferenceValue String    // JSON string
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 2.3 API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 获取当前用户信息 |
| PUT | /api/auth/profile | 更新用户资料 |

### 2.4 前端页面

- `/login` - 登录页
- `/register` - 注册页
- 认证成功后跳转到 `/chat`

---

## 三、会话管理模块

### 3.1 会话数据模型

```prisma
// 会话表（Chat Session）
model Session {
  id              String    @id @default(uuid())
  userId          String
  title           String?   // 会话标题，第一条消息生成
  status          SessionStatus @default(ACTIVE)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastActivityAt  DateTime  @default(now())  // 最后活动时间

  // Secretary 分配（会话创建时分配）
  secretaryId     String?   // 负责此会话的 Secretary Agent ID

  // 关联
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages        Message[]
  tasks           Task[]
  attachments     Attachment[]
  contextHistory  ContextHistory[]

  // 索引
  @@index([userId, updatedAt])
}

enum SessionStatus {
  ACTIVE      // 活跃
  ARCHIVED    // 已归档
  CLOSED      // 已关闭
}

// 消息表
model Message {
  id              String    @id @default(uuid())
  sessionId       String
  role            MessageRole
  content         String    @db.Text
  inputType       InputType?  // 问题类/需求类/执行类
  complexity      Complexity? // 任务复杂度
  parentMessageId String?   // 用于消息引用/回复
  createdAt       DateTime  @default(now())

  // 关联
  session         Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  replyTo         Message?  @relation("MessageReplies", fields: [parentMessageId], references: [id])
  replies         Message[] @relation("MessageReplies")
  attachments     Attachment[]
  task            Task?     // 如果此消息触发任务

  @@index([sessionId, createdAt])
}

enum MessageRole {
  USER        // 用户
  ASSISTANT   // AI 助手（Secretary）
  SYSTEM      // 系统消息
  WORKER      // Worker Agent 消息
}

enum InputType {
  QUESTION    // 问题类
  REQUIREMENT // 需求类
  EXECUTION   // 执行类
}

enum Complexity {
  SIMPLE      // 简单
  MEDIUM      // 中等
  COMPLEX     // 复杂
}

// 附件表
model Attachment {
  id              String    @id @default(uuid())
  sessionId       String
  messageId       String?
  fileName        String
  fileType        String
  fileSize        Int
  filePath        String    // 存储路径
  storageType     StorageType @default(LOCAL)
  createdAt       DateTime  @default(now())

  session         Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  message         Message?  @relation(fields: [messageId], references: [id], onDelete: SetNull)

  @@index([sessionId])
}

enum StorageType {
  LOCAL      // 本地存储
  S3         // 对象存储
}
```

### 3.2 API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sessions | 获取用户所有会话列表 |
| POST | /api/sessions | 创建新会话 |
| GET | /api/sessions/:id | 获取会话详情（含消息） |
| PUT | /api/sessions/:id | 更新会话（标题、状态） |
| DELETE | /api/sessions/:id | 删除会话 |
| POST | /api/sessions/:id/messages | 发送消息 |

### 3.3 前端页面结构

```
/chat                      # 空白 Chat 页面（无 session）
  ├── 左侧会话列表 Sidebar
  │    └── SessionCard (会话卡片)
  └── 右侧聊天区域
       └── 空状态提示 "开始一个新对话"

/chat/:sessionId          # 会话详情页面
  ├── 左侧会话列表 Sidebar
  │    └── SessionCard (带任务状态)
  ├── 右侧聊天区域
  │    ├── MessageList (消息流)
  │    ├── TaskCard (任务进度卡片，可点击展开)
  │    └── InputArea (输入框 + 附件上传)
  └── 可选：右侧产物面板 ProductsPanel
```

---

## 四、消息发送与 Worker 分配机制

### 4.1 消息发送流程

```
用户输入 + 附件
    ↓
点击发送 / 按回车
    ↓
前端 POST /api/sessions/:id/messages
    ↓
后端创建 Message 记录
    ↓
判断：Session 是否已有 Secretary？
    ├─ 否 → 创建 SessionWorker + 分配 Secretary
    └─ 是 → 继续使用已有 Secretary
    ↓
Secretary 分析用户输入
    ↓
分类：问题类 / 需求类 / 执行类
    ↓
根据分类执行不同处理
    ↓
返回响应 → 写入 Message → WebSocket 推送
    ↓
前端渲染消息 + 任务卡片（如有）
```

### 4.2 SessionWorker 分配机制

```prisma
// 会话 Worker（Secretary 分配记录）
model SessionWorker {
  id              String    @id @default(uuid())
  sessionId       String    @unique
  secretaryId     String    // 分配的 Secretary Agent ID
  status          WorkerStatus @default(ACTIVE)
  startedAt       DateTime  @default(now())
  lastActiveAt    DateTime  @default(now())
  endedAt         DateTime?

  // 关联
  session         Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

enum WorkerStatus {
  ACTIVE      // 工作中的
  IDLE        // 空闲中
  ENDED       // 已结束
}
```

### 4.3 Secretary（秘书）工作流程

```
┌─────────────────────────────────────────────────────────┐
│                    Secretary 工作流                      │
├─────────────────────────────────────────────────────────┤
│  1. 接收用户消息                                         │
│     ↓                                                   │
│  2. 输入分类（QUESTION / REQUIREMENT / EXECUTION）       │
│     ↓                                                   │
│  3. 复杂度评估（SIMPLE / MEDIUM / COMPLEX）              │
│     ↓                                                   │
│  4. 处理策略：                                           │
│     ├─ QUESTION: 搜索 → 回答                             │
│     ├─ REQUIREMENT: 澄清需求 → 确认 → 转执行             │
│     └─ EXECUTION: 调度 Worker 执行                       │
│     ↓                                                   │
│  5. 记录工作到 ContextHistory                            │
│     ↓                                                   │
│  6. 返回响应（可包含 Task 进度）                          │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Secretary Agent 配置（数据库驱动）

```prisma
// Agent 类型定义
model AgentProfile {
  id              String    @id @default(uuid())
  code            String    @unique  // e.g., "SECRETARY", "CODER", "DESIGNER"
  name            String    // e.g., "智能秘书", "开发工程师"
  description     String?
  avatar          String?
  type            AgentType
  basePrompt      String    @db.Text
  skills          AgentSkillBinding[]
  projects        ProjectAgent[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum AgentType {
  SECRETARY   // 秘书类型
  WORKER      // 执行者类型
  MANAGER     // 管理类型
}

// Skill 定义
model SkillProfile {
  id              String    @id @default(uuid())
  code            String    @unique  // e.g., "code_review", "ui_design"
  name            String
  description     String?
  enabled         Boolean   @default(true)
  config          Json      // Skill 特定配置
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// Agent-Skill 绑定
model AgentSkillBinding {
  id              String    @id @default(uuid())
  agentId         String
  skillId         String
  priority        Int       @default(0)
  enabled         Boolean   @default(true)

  agent           AgentProfile @relation(fields: [agentId], references: [id], onDelete: Cascade)
  skill           SkillProfile @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@unique([agentId, skillId])
}
```

---

## 五、任务执行模块

### 5.1 任务数据模型

```prisma
// 任务表
model Task {
  id              String    @id @default(uuid())
  sessionId       String
  messageId       String?   // 触发此任务的消息
  parentTaskId    String?   // 父任务 ID（子任务引用）
  taskName        String
  description     String?   @db.Text
  status          TaskStatus @default(PENDING)
  priority        Priority   @default(MEDIUM)
  complexity      Complexity?

  // 执行信息
  assignedAgentId String?   // 分配的 Worker Agent ID
  result          String?   @db.Text  // 执行结果
  errorMessage    String?   @db.Text  // 错误信息

  // 时间戳
  createdAt       DateTime  @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  updatedAt       DateTime  @updatedAt

  // 关联
  session         Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  message         Message?  @relation(fields: [messageId], references: [id], onDelete: SetNull)
  parentTask      Task?     @relation("TaskSubTasks", fields: [parentTaskId], references: [id])
  subTasks        Task[]    @relation("TaskSubTasks")
  workProducts    WorkProduct[]
  contextHistory  ContextHistory[]

  @@index([sessionId, status])
  @@index([assignedAgentId, status])
}

enum TaskStatus {
  PENDING       // 待处理
  IN_PROGRESS   // 进行中
  WAITING       // 等待中（等待子任务）
  COMPLETED     // 已完成
  FAILED        // 失败
  CANCELLED     // 已取消
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

// 工作产物表
model WorkProduct {
  id              String    @id @default(uuid())
  taskId          String
  name            String
  type            String    // e.g., "code", "document", "image"
  content         String?   @db.Text
  filePath        String?
  metadata        Json?
  createdAt       DateTime  @default(now())

  task            Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
}
```

### 5.2 任务执行流程（Secretary 调度）

```
用户: "帮我写一个用户登录功能"

Secretary 接收 → 分类为 REQUIREMENT
    ↓
Secretary 沟通需求细节（多轮）
    ↓
用户确认需求
    ↓
Secretary 分析复杂度 → COMPLEX
    ↓
Secretary 创建 Task（任务名称、描述、优先级、复杂度）
    ↓
Secretary 分配 Worker Agent（根据任务类型选择合适的 Agent）
    ↓
Worker Agent 执行任务
    ↓
Worker 上报进度 → 写入 ContextHistory
    ↓
Worker 完成 → 写入 WorkProduct
    ↓
Secretary 汇总结果 → 返回给用户
    ↓
用户确认 / 打回 / 提新需求
```

### 5.3 Worker Agent 池（数据库驱动）

```prisma
// 虚拟员工模板
model VirtualEmployeeTemplate {
  id              String    @id @default(uuid())
  code            String    @unique  // e.g., "SENIOR_CODER", "UI_DESIGNER"
  name            String
  role            String    // 角色描述
  department      String?   // 部门
  skills          Json      // 技能列表
  avatar          String?
  basePrompt      String    @db.Text
  defaultEnabled  Boolean   @default(true)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// 项目-Agent 绑定
model ProjectAgent {
  id              String    @id @default(uuid())
  projectId       String
  agentId         String
  enabled         Boolean   @default(true)
  config          Json?     // 项目特定配置

  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  agent           AgentProfile @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@unique([projectId, agentId])
}
```

---

## 六、跨 Session 任务隔离机制

### 6.1 设计原则

1. **Session 级别隔离**：每个 Session 独立运行，互不干扰
2. **Secretary 绑定 Session**：一个 Session 分配一个 Secretary，贯穿整个会话
3. **Worker 生命周期**：Worker 任务未完成时，即使切换 Session，任务继续运行
4. **用户离开检测**：用户离开 Session 一定时间后，可选择挂起或结束 Worker

### 6.2 实现机制

```prisma
// 上下文历史（完整记录 Secretary 和 Worker 的工作过程）
model ContextHistory {
  id              String    @id @default(uuid())
  sessionId       String
  taskId          String?
  agentId         String    // 哪个 Agent 执行的
  action          String    // 执行的动作
  input           String?   @db.Text  // 输入
  output          String?   @db.Text  // 输出
  metadata        Json?     // 额外信息（进度 %、时间等）
  createdAt       DateTime  @default(now())

  session         Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  task            Task?     @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([sessionId, createdAt])
  @@index([taskId, createdAt])
}
```

### 6.3 切换 Session 时的行为

| 场景 | 行为 |
|------|------|
| 用户在 Task 进行中切换 Session | 任务继续在后台运行，不中断 |
| 用户切回原 Session | 显示最新任务进度 |
| 用户离开 Session 超过 30 分钟 | Secretary 进入 IDLE 状态 |
| 用户离开 Session 超过 24 小时 | 可选择结束所有 Worker 任务 |
| 用户返回原 Session | Secretary 恢复 ACTIVE，继续工作 |

### 6.4 Session 状态同步（WebSocket）

```typescript
// WebSocket 消息类型
interface WSMessage {
  type: 'message' | 'task_update' | 'task_completed' | 'worker_status'
  payload: any
  timestamp: number
}

// 任务进度更新
interface TaskUpdatePayload {
  taskId: string
  status: TaskStatus
  progress: number  // 0-100
  message?: string
  agentId: string
}
```

---

## 七、数据持久化与 UI 展示

### 7.1 数据流完整图

```
用户输入 + 附件
    ↓
POST /api/sessions/:id/messages
    ↓
┌─────────────────────────────────────────────────────────┐
│ 后端处理                                                │
├─────────────────────────────────────────────────────────┤
│ 1. 创建 Message 记录                                    │
│ 2. 上传附件 → Attachment 记录                           │
│ 3. 检查/创建 SessionWorker + 分配 Secretary             │
│ 4. Secretary 分析输入 → InputType + Complexity          │
│ 5. Secretary 执行处理（可能创建 Task）                   │
│ 6. 任务执行过程中 → ContextHistory 记录每一步            │
│ 7. 任务完成后 → WorkProduct 记录产物                    │
│ 8. WebSocket 推送更新                                   │
└─────────────────────────────────────────────────────────┘
    ↓
前端接收 → 渲染消息列表 + 任务卡片
```

### 7.2 UI 展示设计

#### 7.2.1 会话列表（Sidebar）

```
┌─────────────────────┐
│ 我的会话             │
├─────────────────────┤
│ [+] 新建对话         │
├─────────────────────┤
│ 📄 项目A讨论         │ ← 点击进入 /chat/:id
│    最后消息...       │
│    🟢 进行中         │ ← 任务状态徽章
├─────────────────────┤
│ 📄 需求确认          │
│    好的，我确认      │
│    ✅ 已完成         │
├─────────────────────┤
│ 📄 技术问题          │
│    如何配置...       │
│    💬 进行中         │
└─────────────────────┘
```

#### 7.2.2 消息流 + 任务卡片

```
用户: 帮我写一个用户登录功能
      [附件: login_spec.pdf]

Secretary: 好的，我来帮您实现用户登录功能。
           首先我需要确认几点：
           1. 使用什么技术栈？（React/Vue/其他）
           2. 需要支持哪些登录方式？（账号密码/验证码/第三方）
           3. 是否需要注册功能？

      ┌──────────────────────────────┐
      │ 📋 任务：用户登录功能          │
      │ 状态：需求确认中              │
      │ 复杂度：中等                  │
      │ 分配给：前端工程师            │
      └──────────────────────────────┘

用户: 使用 React + Node.js，只需要账号密码登录

Secretary: 明白，开始为您创建任务。

      ┌──────────────────────────────┐
      │ 📋 任务：用户登录功能          │
      │ ████████░░ 60%               │
      │ 步骤：                        │
      │   ✓ 编写后端 API              │
      │   ✓ 编写前端登录页面          │
      │   → 编写数据库模型            │
      └──────────────────────────────┘

Worker (前端工程师): 登录页面已创建完成。
                     [产物: login.tsx]

Worker (后端工程师): 登录 API 已完成。
                     [产物: authController.ts]
```

#### 7.2.3 点击任务卡片展开详情

```
┌────────────────────────────────────────────────────────────┐
│ 📋 任务详情                                                │
├────────────────────────────────────────────────────────────┤
│ 任务名称：用户登录功能                                      │
│ 状态：已完成                                               │
│ 创建时间：2024-01-15 10:30                                 │
│ 完成时间：2024-01-15 10:45                                 │
│ 执行时长：15 分钟                                          │
│ 复杂度：中等                                               │
│ 执行者：前端工程师、后端工程师                              │
├────────────────────────────────────────────────────────────┤
│ 工作流程：                                                 │
│   1. [10:30] Secretary 接收需求                            │
│   2. [10:31] 创建任务，分配 Worker                         │
│   3. [10:32] 后端工程师：编写登录 API                      │
│   4. [10:38] 前端工程师：编写登录页面                       │
│   5. [10:45] 任务完成                                      │
├────────────────────────────────────────────────────────────┤
│ 产物：                                                     │
│   - login.tsx (前端)                                       │
│   - authController.ts (后端)                               │
│   - login.sql (数据库)                                     │
├────────────────────────────────────────────────────────────┤
│ [查看代码] [重新执行] [关闭]                                │
└────────────────────────────────────────────────────────────┘
```

---

## 八、完整 API 设计

### 8.1 认证 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 登出 |
| GET | /api/auth/me | 获取当前用户 |
| PUT | /api/auth/profile | 更新资料 |

### 8.2 会话 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sessions | 获取会话列表 |
| POST | /api/sessions | 创建会话 |
| GET | /api/sessions/:id | 获取会话详情 |
| PUT | /api/sessions/:id | 更新会话 |
| DELETE | /api/sessions/:id | 删除会话 |
| POST | /api/sessions/:id/messages | 发送消息 |

### 8.3 任务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/sessions/:id/tasks | 获取会话任务列表 |
| GET | /api/tasks/:id | 获取任务详情 |
| GET | /api/tasks/:id/history | 获取任务执行历史 |
| GET | /api/tasks/:id/products | 获取任务产物 |
| PUT | /api/tasks/:id/status | 更新任务状态 |
| POST | /api/tasks/:id/approve | 确认任务完成 |
| POST | /api/tasks/:id/reject | 打回任务 |

### 8.4 Worker Agent API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/agents | 获取可用 Agent 列表 |
| GET | /api/agents/:id | 获取 Agent 详情 |
| GET | /api/agents/:id/performance | 获取 Agent 绩效 |

---

## 九、前端页面路由

```
/                       # 首页（未登录 → 登录页，已登录 → /chat）
├── /login              # 登录
├── /register           # 注册
├── /chat               # 空白 Chat 页面（会话列表 + 空聊天区）
│   └── /chat/:sessionId # 具体的会话页面
├── /chat/:sessionId/tasks/:taskId # 任务详情弹窗/页面
└── /profile            # 用户设置
```

---

## 十、数据库 ER 关系图

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │────<│ Session  │────<│ Message  │
└──────────┘     └────┬─────┘     └──────────┘
                      │                │
                      │                │
                 ┌────▼─────┐     ┌────▼─────┐
                 │Session   │     │ Attachment
                 │Worker    │     └──────────┘
                 └────┬─────┘
                      │
              ┌───────▼───────┐
              │     Task      │
              └───────┬───────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌────────┐ ┌───────────┐
    │WorkProduct│ │Context │ │  Project  │
    └──────────┘ │History │ └───────────┘
                 └────────┘
```

---

## 十一、关键技术点

### 11.1 数据库驱动 Agent 配置

所有 Agent 和 Skill 定义必须从数据库读取：

```typescript
// AgentProfileLoader - 从数据库加载 Agent
class AgentProfileLoader {
  async loadAgent(code: string): Promise<AgentProfile> {
    return prisma.agentProfile.findUnique({
      where: { code },
      include: { skills: { include: { skill: true } } }
    })
  }

  async loadWorkersForTask(taskType: string): Promise<AgentProfile[]> {
    // 根据任务类型筛选合适的 Worker
  }
}
```

### 11.2 WebSocket 实时通信

```typescript
// 消息推送
wsServer.on('connection', (socket, req) => {
  const sessionId = getSessionIdFromRequest(req)

  // 订阅此 Session 的消息
  socket.join(`session:${sessionId}`)

  // 发送任务更新
  socket.on('task_update', (data) => {
    io.to(`session:${sessionId}`).emit('task_update', data)
  })
})
```

### 11.3 文件上传处理

```typescript
// 附件上传
const upload = multer({
  storage: multerS3({
    bucket: process.env.S3_BUCKET,
    // or local storage
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

app.post('/api/sessions/:id/attachments', upload.single('file'), async (req, res) => {
  // 保存 Attachment 记录
})
```

---

## 十二、验收标准

### 12.1 用户认证
- [ ] 用户可以注册账号
- [ ] 用户可以登录/登出
- [ ] JWT Token 正确存储和发送
- [ ] Token 自动刷新机制正常工作

### 12.2 会话管理
- [ ] 用户可以创建新会话
- [ ] 会话列表正确展示
- [ ] 切换会话不丢失数据
- [ ] 会话历史永久保存
- [ ] 支持项目维度（Project → Session）

### 12.3 消息发送
- [ ] 支持文本 + 附件发送
- [ ] 消息实时显示（WebSocket）
- [ ] Session 创建时自动分配 Secretary
- [ ] 消息可撤回、可编辑
- [ ] 消息可引用回复
- [ ] 消息已读/未读状态正确
- [ ] AI 消息流式输出（打字机效果）

### 12.4 Secretary 工作
- [ ] 正确分类输入类型（QUESTION/REQUIREMENT/EXECUTION）
- [ ] 正确评估任务复杂度（SIMPLE/MEDIUM/COMPLEX）
- [ ] 合理调度 Worker Agent
- [ ] 完整记录工作过程到 ContextHistory

### 12.5 任务执行
- [ ] 任务进度实时更新
- [ ] 任务完成后可查看详情
- [ ] 所有工作过程可追溯
- [ ] 任务可取消
- [ ] 高优先级任务可插队

### 12.6 数据持久化
- [ ] 所有数据存入数据库
- [ ] UI 可查看完整工作历史
- [ ] 产物可下载/查看
- [ ] 文件上传和在线预览

### 12.7 Agent 高级功能
- [ ] Agent 绩效记录完整
- [ ] 失败多次触发自我优化
- [ ] 新领域知识自动收集

### 12.8 基础设施
- [ ] WebSocket 断线自动重连
- [ ] 网络状态正确处理

---

## 十四、补充设计（完整版 Review 补充）

### 14.1 项目(Project)维度

```prisma
// 项目表
model Project {
  id              String    @id @default(uuid())
  userId          String
  name            String
  description     String?
  status          ProjectStatus @default(ACTIVE)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // 关联
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions        Session[]
  agents          ProjectAgent[]

  @@index([userId, status])
}

enum ProjectStatus {
  ACTIVE
  ARCHIVED
  DELETED
}
```

修改 Session 模型，添加 projectId：
```prisma
model Session {
  // ... 现有字段
  projectId       String?   // 所属项目，可为空（临时会话）
  project         Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
}
```

### 14.2 消息撤回/编辑/引用/已读

```prisma
model Message {
  // ... 现有字段
  isEdited        Boolean   @default(false)
  editedAt        DateTime?
  isDeleted       Boolean   @default(false)
  deletedAt       DateTime?
  replyToId       String?   // 引用消息 ID
  replyTo         Message?  @relation("MessageReplyTo", fields: [replyToId], references: [id])
  replies         Message[] @relation("MessageReplyTo")

  // 已读状态（关联查询）
  readStatus      MessageReadStatus[]
}

// 消息已读状态
model MessageReadStatus {
  id              String    @id @default(uuid())
  messageId       String
  userId          String
  readAt          DateTime  @default(now())

  message         Message   @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])
}
```

### 14.3 Token 刷新机制

```typescript
// 中间件：检查 Token 有效性，自动刷新
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 检查是否需要刷新（提前 5 分钟）
    const expiresAt = decoded.exp * 1000
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    if (expiresAt - now < fiveMinutes) {
      // 发放新 Token
      const newToken = generateToken(decoded.userId)
      res.setHeader('X-New-Token', newToken)
    }

    req.userId = decoded.userId
    next()
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
```

### 14.4 Agent 性能考核

```prisma
// Agent 绩效记录
model AgentPerformance {
  id              String    @id @default(uuid())
  agentId         String
  taskId          String?
  sessionId       String?

  // 考核指标
  status          PerformanceStatus  // SUCCESS / FAIL / REJECTED
  duration        Int?       // 执行耗时（秒）
  qualityScore    Int?       // 质量评分 1-100
  retryCount      Int        @default(0)

  feedback        String?    @db.Text  // 用户反馈
  rejectReason    String?    @db.Text  // 打回原因

  createdAt       DateTime  @default(now())

  @@index([agentId, createdAt])
}

enum PerformanceStatus {
  SUCCESS     // 成功
  FAIL        // 失败
  REJECTED    // 被打回
  PENDING     // 待评估
}

// 触发自我优化阈值配置
model AgentOptimizationConfig {
  id              String    @id @default(uuid())
  agentId         String    @unique

  // 触发阈值
  failThreshold   Int       @default(3)      // 连续失败次数
  rejectThreshold Int       @default(5)      // 累计被打回次数

  // 优化记录
  lastOptimizedAt DateTime?
  optimizationCount Int     @default(0)

  // 当前配置（优化后会更新）
  currentPrompt   String?   @db.Text
  currentSkills   Json?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

### 14.5 领域知识库

```prisma
// 领域知识
model DomainKnowledge {
  id              String    @id @default(uuid())
  domain          String    // 领域名称 e.g., "React", "Python"
  topic           String    // 主题
  content         String    @db.Text
  source          String?   // 来源 URL
  confidence      Float     @default(0.5)

  // 自动标记
  isAutoCollected Boolean   @default(false)
  verified        Boolean   @default(false)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([domain, topic])
  @@index([domain])
}
```

### 14.6 任务取消与优先级

```prisma
model Task {
  // ... 现有字段
  cancelRequested Boolean  @default(false)  // 用户请求取消
  cancelledAt     DateTime?

  // 优先级队列
  queuePosition   Int?     // 在队列中的位置
}
```

---

## 十五、可实施路径（12 周）

### 阶段一：基础骨架（Week 1-2）

| 序号 | 任务 | 文件 |
|------|------|------|
| 1.1 | 初始化 Monorepo 项目结构 | 根目录 package.json |
| 1.2 | 创建 server 和 client 子包 | packages/server, packages/client |
| 1.3 | 配置 Prisma 和数据库连接 | server/prisma/schema.prisma |
| 1.4 | 实现基础认证（注册/登录/JWT） | server/src/routes/auth.ts |
| 1.5 | 搭建前端基础框架 | client/src/App.tsx |

### 阶段二：会话与消息（Week 3-4）

| 序号 | 任务 | 文件 |
|------|------|------|
| 2.1 | 实现 Session CRUD API | server/src/routes/sessions.ts |
| 2.2 | 实现 Message 发送 API（含撤回/编辑） | server/src/routes/messages.ts |
| 2.3 | 实现 WebSocket 基础连接 | server/src/services/websocket.ts |
| 2.4 | 实现前端 Chat 页面 | client/src/pages/Chat.tsx |
| 2.5 | 实现会话列表 Sidebar | client/src/components/Sidebar.tsx |

### 阶段三：Agent 核心（Week 5-6）

| 序号 | 任务 | 文件 |
|------|------|------|
| 3.1 | 设计 Secretary Agent 提示词 | server/src/agents/secretary/prompt.ts |
| 3.2 | 实现输入分类器 | server/src/agents/classifier/index.ts |
| 3.3 | 实现复杂度评估 | server/src/agents/classifier/complexity.ts |
| 3.4 | 实现 Worker 调度器 | server/src/agents/scheduler/index.ts |
| 3.5 | 实现 ContextHistory 记录 | server/src/services/context.service.ts |

### 阶段四：任务执行（Week 7-8）

| 序号 | 任务 | 文件 |
|------|------|------|
| 4.1 | 实现 Task 创建与状态管理 | server/src/services/task.service.ts |
| 4.2 | 实现 Worker Agent 执行逻辑 | server/src/agents/workers/*.ts |
| 4.3 | 实现任务进度 WebSocket 推送 | server/src/services/websocket.ts |
| 4.4 | 实现前端任务卡片组件 | client/src/components/TaskCard.tsx |
| 4.5 | 实现任务详情弹窗 | client/src/components/TaskDetailModal.tsx |

### 阶段五：完善与优化（Week 9-10）

| 序号 | 任务 | 文件 |
|------|------|------|
| 5.1 | 实现消息已读状态 | server/src/services/readStatus.service.ts |
| 5.2 | 实现文件上传与预览 | server/src/routes/attachments.ts |
| 5.3 | 实现 JWT 刷新机制 | server/src/middleware/auth.ts |
| 5.4 | 实现 WebSocket 重连 | client/src/hooks/useWebSocket.ts |
| 5.5 | 实现打字机效果 | client/src/components/Chat/TypingIndicator.tsx |

### 阶段六：高级功能（Week 11-12）

| 序号 | 任务 | 文件 |
|------|------|------|
| 6.1 | 实现 Agent 性能考核 | server/src/services/performance.service.ts |
| 6.2 | 实现自我优化机制 | server/src/agents/optimizer/index.ts |
| 6.3 | 实现领域知识库 | server/src/services/knowledge.service.ts |
| 6.4 | 实现项目维度 | server/src/routes/projects.ts |
| 6.5 | 实现会话搜索 | server/src/services/search.service.ts |