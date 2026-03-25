import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface Agent {
  id: string
  code: string
  name: string
  description?: string
  avatar?: string
  type: string
  basePrompt: string
  createdAt: string
  skills?: Array<{
    id: string
    skill: {
      id: string
      code: string
      name: string
      description?: string
    }
  }>
}

export default function AgentManagement() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    avatar: '',
    type: 'WORKER',
    basePrompt: ''
  })

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const url = editingAgent ? `/api/agents/${editingAgent.id}` : '/api/agents'
      const method = editingAgent ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        fetchAgents()
        closeModal()
      }
    } catch (err) {
      console.error('Failed to save agent:', err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个 Agent 吗？')) return

    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        fetchAgents()
      }
    } catch (err) {
      console.error('Failed to delete agent:', err)
    }
  }

  const openCreateModal = () => {
    setEditingAgent(null)
    setFormData({
      code: '',
      name: '',
      description: '',
      avatar: '',
      type: 'WORKER',
      basePrompt: ''
    })
    setShowModal(true)
  }

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData({
      code: agent.code,
      name: agent.name,
      description: agent.description || '',
      avatar: agent.avatar || '',
      type: agent.type,
      basePrompt: agent.basePrompt
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingAgent(null)
  }

  const getTypeText = (type: string) => {
    const texts: Record<string, string> = {
      SECRETARY: '秘书',
      WORKER: '工作者',
      MANAGER: '管理者'
    }
    return texts[type] || type
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      SECRETARY: 'var(--color-primary)',
      WORKER: 'var(--color-success)',
      MANAGER: 'var(--color-warning)'
    }
    return colors[type] || 'var(--color-text-muted)'
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        加载中...
      </div>
    )
  }

  return (
    <div style={{ padding: 'var(--spacing-lg)', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-lg)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Agent 管理
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            管理数字员工和智能助手
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link
            to="/admin/skills"
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              textDecoration: 'none',
              fontSize: '0.875rem'
            }}
          >
            技能管理
          </Link>
          <button
            onClick={openCreateModal}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--gradient-primary)',
              color: 'white',
              border: 'none',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            + 创建 Agent
          </button>
        </div>
      </div>

      {/* Agent 列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {agents.map(agent => (
          <div
            key={agent.id}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                overflow: 'hidden'
              }}>
                {agent.avatar ? (
                  <img src={agent.avatar} alt={agent.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  agent.name.charAt(0)
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, marginBottom: '0.125rem' }}>{agent.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{agent.code}</div>
              </div>
              <span style={{
                fontSize: '0.625rem',
                padding: '0.125rem 0.375rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: getTypeColor(agent.type) + '20',
                color: getTypeColor(agent.type)
              }}>
                {getTypeText(agent.type)}
              </span>
            </div>

            {agent.description && (
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '0.75rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {agent.description}
              </p>
            )}

            {/* 技能标签 */}
            {agent.skills && agent.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
                {agent.skills.map((s: any) => (
                  <span key={s.id} style={{
                    fontSize: '0.625rem',
                    padding: '0.125rem 0.375rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--color-bg-hover)',
                    color: 'var(--color-text-secondary)'
                  }}>
                    {s.skill.name}
                  </span>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => openEditModal(agent)}
                style={{
                  flex: 1,
                  padding: '0.375rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-hover)',
                  color: 'var(--color-text)',
                  border: 'none',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                编辑
              </button>
              <Link
                to={`/admin/agents/${agent.id}/skills`}
                style={{
                  flex: 1,
                  padding: '0.375rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-primary-bg)',
                  color: 'var(--color-primary)',
                  border: 'none',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  textAlign: 'center'
                }}
              >
                绑定技能
              </Link>
              <button
                onClick={() => handleDelete(agent.id)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-error)',
                  border: '1px solid var(--color-error)',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--color-text-muted)'
          }}>
            暂无 Agent，点击"创建 Agent"开始添加
          </div>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      {showModal && (
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
            maxWidth: '500px',
            maxHeight: '90vh',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
            overflow: 'auto'
          }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              {editingAgent ? '编辑 Agent' : '创建 Agent'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  代码标识 *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  required
                  disabled={!!editingAgent}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  类型
                </label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="SECRETARY">秘书 (Secretary)</option>
                  <option value="WORKER">工作者 (Worker)</option>
                  <option value="MANAGER">管理者 (Manager)</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  头像 URL
                </label>
                <input
                  type="text"
                  value={formData.avatar}
                  onChange={e => setFormData({ ...formData, avatar: e.target.value })}
                  placeholder="https://..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  系统提示词
                </label>
                <textarea
                  value={formData.basePrompt}
                  onChange={e => setFormData({ ...formData, basePrompt: e.target.value })}
                  rows={4}
                  placeholder="输入 Agent 的系统提示词..."
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-hover)',
                    color: 'var(--color-text)',
                    border: 'none',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--gradient-primary)',
                    color: 'white',
                    border: 'none',
                    fontSize: '0.875rem',
                    cursor: 'pointer'
                  }}
                >
                  {editingAgent ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}