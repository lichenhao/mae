import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

interface Session {
  id: string
  title: string
  lastActivityAt: string
  _count: { messages: number; tasks: number }
}

interface ChatProps {
  onLogout: () => void
}

export default function Chat({ onLogout }: ChatProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSessions(data)
      } else if (res.status === 401) {
        onLogout()
      }
    } catch (err) {
      setError('加载会话失败')
    } finally {
      setLoading(false)
    }
  }

  const createSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: '新对话' })
      })

      if (res.ok) {
        const session = await res.json()
        navigate(`/chat/${session.id}`)
      }
    } catch (err) {
      setError('创建会话失败')
    }
  }

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString('zh-CN')
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--color-bg)' }}>
      {/* 侧边栏 */}
      <aside style={{
        width: '300px',
        backgroundColor: 'var(--color-bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-border)'
      }}>
        <div style={{ padding: 'var(--spacing-lg)' }}>
          {/* 头部 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)' }}>
              我的会话
            </h2>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.375rem 0.75rem',
                color: 'var(--color-text-secondary)',
                fontSize: '0.75rem',
                backgroundColor: 'var(--color-bg-hover)',
                borderRadius: 'var(--radius-full)'
              }}
            >
              登出
            </button>
          </div>

          {/* 新建对话按钮 */}
          <button
            onClick={createSession}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'var(--gradient-primary)',
              color: 'white',
              borderRadius: 'var(--radius-lg)',
              fontWeight: 500,
              marginBottom: 'var(--spacing-lg)',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            + 新建对话
          </button>

          {error && (
            <div style={{
              color: 'var(--color-error)',
              fontSize: '0.875rem',
              marginBottom: 'var(--spacing-md)',
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-md)'
            }}>
              {error}
            </div>
          )}

          {/* 会话列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-xl)' }}>
                加载中...
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-xl)' }}>
                <p style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>💬</p>
                <p>暂无会话</p>
                <p style={{ fontSize: '0.875rem', marginTop: 'var(--spacing-sm)' }}>
                  点击上方"新建对话"开始
                </p>
              </div>
            ) : (
              sessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/chat/${session.id}`}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--color-bg-card)',
                    textDecoration: 'none',
                    color: 'var(--color-text)',
                    transition: 'all var(--transition-fast)',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div style={{
                    fontWeight: 500,
                    marginBottom: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {session.title}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>{formatTime(session.lastActivityAt)}</span>
                    <span>{session._count.messages} 条消息</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--gradient-hero)'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          {/* Logo */}
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto var(--spacing-lg)',
            background: 'var(--gradient-primary)',
            borderRadius: 'var(--radius-2xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2.5rem',
            boxShadow: 'var(--shadow-xl)'
          }}>
            🤖
          </div>

          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 600,
            marginBottom: 'var(--spacing-sm)',
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Multi-Agent
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
            选择一个会话或开始新对话
          </p>
          <button
            onClick={createSession}
            style={{
              padding: '0.875rem 2rem',
              background: 'var(--gradient-primary)',
              color: 'white',
              borderRadius: 'var(--radius-full)',
              fontWeight: 500,
              fontSize: '1rem',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            开始新对话
          </button>
        </div>
      </main>
    </div>
  )
}