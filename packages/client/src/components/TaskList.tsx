import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

interface Task {
  id: string
  taskName: string
  description?: string
  status: string
  priority: string
  complexity?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

interface TaskListProps {
  onTaskClick?: (taskId: string) => void
}

export default function TaskList({ onTaskClick }: TaskListProps) {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchTasks()
  }, [sessionId])

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (err) {
      console.error('Failed to fetch tasks')
    } finally {
      setLoading(false)
    }
  }

  // 筛选进行中的任务
  const activeTasks = tasks.filter(t =>
    t.status === 'PENDING' || t.status === 'IN_PROGRESS' || t.status === 'WAITING'
  )

  const displayTasks = showAll ? tasks : activeTasks.slice(0, 3)

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'var(--color-text-muted)',
      IN_PROGRESS: 'var(--color-primary)',
      WAITING: 'var(--color-warning)',
      COMPLETED: 'var(--color-success)',
      FAILED: 'var(--color-error)',
      CANCELLED: 'var(--color-text-muted)'
    }
    return colors[status] || 'var(--color-text-muted)'
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      PENDING: '待处理',
      IN_PROGRESS: '进行中',
      WAITING: '等待中',
      COMPLETED: '已完成',
      FAILED: '失败',
      CANCELLED: '已取消'
    }
    return texts[status] || status
  }

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'var(--color-text-muted)',
      MEDIUM: 'var(--color-info)',
      HIGH: 'var(--color-warning)',
      URGENT: 'var(--color-error)'
    }
    return colors[priority] || 'var(--color-text-muted)'
  }

  // 格式化时间
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>加载中...</div>
  }

  if (tasks.length === 0) {
    return null
  }

  return (
    <div style={{ padding: '0.75rem' }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <span>📋</span>
        <span>任务</span>
        <span style={{ fontWeight: 400 }}>({activeTasks.length} 进行中)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {displayTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskClick?.(task.id)}
            style={{
              padding: '0.75rem',
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.25rem'
            }}>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}>
                {task.taskName}
              </span>
              <span style={{
                fontSize: '0.625rem',
                padding: '0.125rem 0.375rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: getStatusColor(task.status) + '20',
                color: getStatusColor(task.status),
                marginLeft: '0.5rem',
                flexShrink: 0
              }}>
                {getStatusText(task.status)}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.7rem',
              color: 'var(--color-text-muted)'
            }}>
              <span style={{ color: getPriorityColor(task.priority) }}>
                {task.priority === 'URGENT' ? '🔴' : task.priority === 'HIGH' ? '🟠' : '⚪'} {task.priority}
              </span>
              {task.complexity && (
                <span>• {task.complexity}</span>
              )}
              <span>• {formatTime(task.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 查看更多按钮 */}
      {tasks.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--color-primary)',
            backgroundColor: 'transparent'
          }}
        >
          查看全部 {tasks.length} 个任务 →
        </button>
      )}

      {showAll && tasks.length > 3 && (
        <button
          onClick={() => setShowAll(false)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginTop: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            backgroundColor: 'transparent'
          }}
        >
          收起 ↑
        </button>
      )}
    </div>
  )
}