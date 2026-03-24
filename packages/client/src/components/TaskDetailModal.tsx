import { useState, useEffect } from 'react'

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
  assignedAgentId?: string
  result?: string
  errorMessage?: string
  session: { id: string; title: string }
  workProducts: Array<{
    id: string
    name: string
    type: string
    content?: string
  }>
  contextHistory: Array<{
    id: string
    agentId: string
    action: string
    input?: string
    output?: string
    createdAt: string
  }>
}

interface TaskDetailModalProps {
  taskId: string
  onClose: () => void
}

export default function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'detail' | 'history' | 'products'>('detail')

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchTaskDetail()
  }, [taskId])

  const fetchTaskDetail = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setTask(data)
      }
    } catch (err) {
      console.error('Failed to fetch task detail')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approved: boolean) => {
    try {
      await fetch(`/api/tasks/${taskId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ approved })
      })
      fetchTaskDetail()
    } catch (err) {
      console.error('Failed to approve/reject task')
    }
  }

  const handleCancel = async () => {
    try {
      await fetch(`/api/tasks/${taskId}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      fetchTaskDetail()
    } catch (err) {
      console.error('Failed to cancel task')
    }
  }

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

  // 格式化时间
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem'
        }}>
          加载中...
        </div>
      </div>
    )
  }

  if (!task) {
    return null
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        backgroundColor: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>任务详情</h2>
          <button
            onClick={onClose}
            style={{
              width: '2rem',
              height: '2rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-bg-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}
          >
            ×
          </button>
        </div>

        {/* Tab 切换 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border)'
        }}>
          {(['detail', 'history', 'products'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '0.75rem',
                fontSize: '0.875rem',
                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
                borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent'
              }}
            >
              {tab === 'detail' ? '详情' : tab === 'history' ? '历史' : '产物'}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {activeTab === 'detail' && (
            <div>
              {/* 任务名称和状态 */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{task.taskName}</h3>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: getStatusColor(task.status) + '20',
                    color: getStatusColor(task.status)
                  }}>
                    {getStatusText(task.status)}
                  </span>
                </div>
                {task.description && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    {task.description}
                  </p>
                )}
              </div>

              {/* 任务信息 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>优先级</div>
                  <div style={{ fontSize: '0.875rem' }}>{task.priority}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>复杂度</div>
                  <div style={{ fontSize: '0.875rem' }}>{task.complexity || '-'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>创建时间</div>
                  <div style={{ fontSize: '0.875rem' }}>{formatTime(task.createdAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>完成时间</div>
                  <div style={{ fontSize: '0.875rem' }}>{task.completedAt ? formatTime(task.completedAt) : '-'}</div>
                </div>
              </div>

              {/* 结果 */}
              {task.result && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>执行结果</div>
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-hover)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {task.result}
                  </div>
                </div>
              )}

              {/* 错误信息 */}
              {task.errorMessage && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginBottom: '0.5rem' }}>错误信息</div>
                  <div style={{
                    padding: '1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.875rem',
                    color: 'var(--color-error)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {task.errorMessage}
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              {task.status === 'COMPLETED' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleApprove(true)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-success)',
                      color: 'white',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 500
                    }}
                  >
                    确认完成
                  </button>
                  <button
                    onClick={() => handleApprove(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-hover)',
                      color: 'var(--color-text)',
                      borderRadius: 'var(--radius-md)',
                      fontWeight: 500
                    }}
                  >
                    打回修改
                  </button>
                </div>
              )}

              {(task.status === 'PENDING' || task.status === 'IN_PROGRESS') && (
                <button
                  onClick={handleCancel}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'transparent',
                    color: 'var(--color-error)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-error)'
                  }}
                >
                  取消任务
                </button>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {task.contextHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                  暂无历史记录
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {task.contextHistory.map((item) => (
                    <div key={item.id} style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-hover)',
                      borderRadius: 'var(--radius-lg)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>{item.agentId}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {formatTime(item.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        {item.action}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              {task.workProducts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>
                  暂无产物
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {task.workProducts.map((product) => (
                    <div key={product.id} style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-hover)',
                      borderRadius: 'var(--radius-lg)'
                    }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        类型: {product.type}
                      </div>
                      {product.content && (
                        <div style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          backgroundColor: 'var(--color-bg-card)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '100px',
                          overflow: 'auto'
                        }}>
                          {product.content}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}