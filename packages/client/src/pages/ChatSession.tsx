import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import TaskList from '../components/TaskList'
import TaskDetailModal from '../components/TaskDetailModal'
import FileUploadButton from '../components/FileUploadButton'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'WORKER'
  content: string
  inputType?: string
  complexity?: string
  createdAt: string
}

interface Session {
  id: string
  title: string
  lastActivityAt: string
}

interface ChatSessionProps {
  onLogout: () => void
}

export default function ChatSession({ onLogout }: ChatSessionProps) {
  // 附件类型
  interface Attachment {
    id: string
    name: string
    type: string
    size: number
  }

  const { sessionId } = useParams<{ sessionId: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [connected, setConnected] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskProgress, setTaskProgress] = useState<Record<string, any>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const token = localStorage.getItem('token')

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // WebSocket 回调
  const handleNewMessage = useCallback((message: Message) => {
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) {
        return prev
      }
      return [...prev, message]
    })
  }, [])

  // 任务进度回调
  const handleTaskProgress = useCallback((progress: any) => {
    setTaskProgress(prev => ({
      ...prev,
      [progress.taskId]: progress
    }))
  }, [])

  const { joinSession } = useWebSocket({
    sessionId,
    onMessage: handleNewMessage,
    onTaskProgress: handleTaskProgress
  })

  useEffect(() => {
    fetchSessions()
    fetchMessages()

    if (sessionId) {
      joinSession(sessionId)
    }
  }, [sessionId])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      }
    } catch (err) {
      console.error('Failed to fetch sessions')
    }
  }

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      } else if (res.status === 401) {
        onLogout()
      }
    } catch (err) {
      console.error('Failed to fetch messages')
    } finally {
      setFetching(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !sessionId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: input,
          attachmentIds: attachments.map(a => a.id)
        })
      })

      if (res.ok) {
        // 不直接添加消息，等待 WebSocket 回调（避免重复）
        setInput('')
        setAttachmentIds([])
      }
    } catch (err) {
      console.error('Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // 处理文件上传完成
  const handleUploadComplete = (attachment: Attachment) => {
    setAttachments(prev => [...prev, attachment])
  }

  // 移除附件
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取角色显示名称
  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      USER: '你',
      ASSISTANT: 'AI 助手',
      SYSTEM: '系统',
      WORKER: '执行者'
    }
    return labels[role] || role
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--color-bg)' }}>
      {/* 侧边栏 */}
      <aside style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : '280px',
        backgroundColor: 'var(--color-bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        position: 'relative',
        borderRight: sidebarCollapsed ? 'none' : '1px solid var(--color-border)'
      }}>
        {/* 折叠按钮 */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            position: 'absolute',
            top: '1rem',
            right: sidebarCollapsed ? '0.5rem' : '-0.75rem',
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>

        {/* 侧边栏内容 */}
        <div style={{
          padding: sidebarCollapsed ? '0.5rem' : 'var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}>
          {/* 新建对话按钮 */}
          <button
            onClick={() => navigate('/chat')}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--gradient-primary)',
              color: 'white',
              borderRadius: 'var(--radius-lg)',
              fontWeight: 500,
              fontSize: '0.875rem',
              marginBottom: sidebarCollapsed ? 'var(--spacing-sm)' : 'var(--spacing-md)',
              boxShadow: 'var(--shadow-md)',
              whiteSpace: 'nowrap',
              overflow: 'hidden'
            }}
          >
            {sidebarCollapsed ? '+' : '+ 新建对话'}
          </button>

          {/* 登出按钮 */}
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem',
              textAlign: 'center',
              marginBottom: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'transparent'
            }}
          >
            {sidebarCollapsed ? '🚪' : '登出'}
          </button>

          {/* 会话列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1, overflow: 'auto' }}>
            {!sidebarCollapsed && sessions.map((session) => (
              <Link
                key={session.id}
                to={`/chat/${session.id}`}
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: session.id === sessionId ? 'var(--color-primary-bg)' : 'transparent',
                  color: session.id === sessionId ? 'var(--color-primary)' : 'var(--color-text)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  transition: 'all var(--transition-fast)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  border: session.id === sessionId ? '1px solid var(--color-primary-light)' : '1px solid transparent'
                }}
              >
                {session.title}
              </Link>
            ))}

            {/* 任务列表 */}
            {!sidebarCollapsed && sessionId && (
              <TaskList onTaskClick={setSelectedTaskId} taskProgress={taskProgress} />
            )}
          </div>
        </div>
      </aside>

      {/* 主聊天区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 消息列表 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
          {fetching ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-xl)' }}>
              加载中...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-xl)' }}>
              开始发送消息来开始对话
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', maxWidth: '900px', margin: '0 auto' }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'USER' ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '1rem 1.25rem',
                    borderRadius: msg.role === 'USER'
                      ? '1.5rem 1.5rem 0.5rem 1.5rem'
                      : '1.5rem 1.5rem 1.5rem 0.5rem',
                    background: msg.role === 'USER'
                      ? 'var(--gradient-primary)'
                      : 'var(--color-bg-card)',
                    color: msg.role === 'USER'
                      ? 'var(--color-message-user-text)'
                      : 'var(--color-message-assistant-text)',
                    boxShadow: msg.role === 'USER' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                    border: msg.role !== 'USER' ? '1px solid var(--color-border)' : 'none'
                  }}>
                    <div style={{
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      marginBottom: '0.25rem',
                      opacity: 0.8
                    }}>
                      {getRoleLabel(msg.role)}
                      <span style={{
                        fontWeight: 400,
                        marginLeft: '0.5rem',
                        fontSize: '0.7rem',
                        opacity: 0.6
                      }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                    <div style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.6,
                      fontSize: '0.9375rem'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 输入区域 - 整体容器 */}
        <div style={{
          padding: 'var(--spacing-md) var(--spacing-lg) var(--spacing-lg)',
          backgroundColor: 'transparent'
        }}>
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: inputFocused ? '1.5rem' : '1rem',
            boxShadow: inputFocused ? '0 0 0 2px var(--color-primary-light), var(--shadow-lg)' : 'var(--shadow-lg)',
            transition: 'all var(--transition-fast)',
            overflow: 'hidden'
          }}>
            {/* 输入框区域 - 无圆角 */}
            <div style={{ padding: '0.75rem 1rem' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                style={{
                  width: '100%',
                  minHeight: '48px',
                  maxHeight: '150px',
                  resize: 'none',
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: 0,
                  lineHeight: 1.5,
                  outline: 'none',
                  boxShadow: 'none',
                  borderRadius: 0
                }}
              />
            </div>

            {/* 底部工具栏 - 无边框 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem'
            }}>
              {/* 左侧工具按钮 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  title="斜杠命令"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'transparent',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="5" x2="5" y2="19" />
                  </svg>
                </button>
                <FileUploadButton
                  sessionId={sessionId || ''}
                  attachments={attachments}
                  onUploadComplete={handleUploadComplete}
                  onRemoveAttachment={handleRemoveAttachment}
                />
              </div>

              {/* 右侧状态和发送 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* 连接状态 */}
                <span style={{
                  fontSize: '0.7rem',
                  color: connected ? 'var(--color-success)' : 'var(--color-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  {connected ? '●' : '○'}
                </span>

                {/* 发送按钮 */}
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  title="发送"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    background: loading || !input.trim()
                      ? 'var(--color-text-muted)'
                      : 'var(--gradient-primary)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    flexShrink: 0
                  }}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 任务详情弹窗 */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}