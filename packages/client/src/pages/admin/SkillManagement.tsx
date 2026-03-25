import { useState, useEffect } from 'react'

interface Skill {
  id: string
  code: string
  name: string
  description?: string
  enabled: boolean
  config: any
  createdAt: string
}

export default function SkillManagement() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    enabled: true,
    config: ''
  })

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchSkills()
  }, [])

  const fetchSkills = async () => {
    try {
      const res = await fetch('/api/skills', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSkills(data)
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const config = formData.config ? JSON.parse(formData.config) : {}
      const payload = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        enabled: formData.enabled,
        config
      }

      const url = editingSkill ? `/api/skills/${editingSkill.id}` : '/api/skills'
      const method = editingSkill ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        fetchSkills()
        closeModal()
      } else {
        alert('保存失败，请检查输入')
      }
    } catch (err) {
      alert('配置必须是有效的 JSON 格式')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个技能吗？')) return

    try {
      const res = await fetch(`/api/skills/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        fetchSkills()
      }
    } catch (err) {
      console.error('Failed to delete skill:', err)
    }
  }

  const handleToggle = async (skill: Skill) => {
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !skill.enabled })
      })
      if (res.ok) {
        fetchSkills()
      }
    } catch (err) {
      console.error('Failed to toggle skill:', err)
    }
  }

  const openCreateModal = () => {
    setEditingSkill(null)
    setFormData({
      code: '',
      name: '',
      description: '',
      enabled: true,
      config: ''
    })
    setShowModal(true)
  }

  const openEditModal = (skill: Skill) => {
    setEditingSkill(skill)
    setFormData({
      code: skill.code,
      name: skill.name,
      description: skill.description || '',
      enabled: skill.enabled,
      config: skill.config ? JSON.stringify(skill.config, null, 2) : ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSkill(null)
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
            技能管理
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            管理 Agent 可用的技能和能力
          </p>
        </div>
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
          + 创建技能
        </button>
      </div>

      {/* 技能列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {skills.map(skill => (
          <div
            key={skill.id}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              opacity: skill.enabled ? 1 : 0.6
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 500 }}>{skill.name}</span>
                <span style={{
                  fontSize: '0.625rem',
                  padding: '0.125rem 0.375rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-bg-hover)',
                  color: 'var(--color-text-muted)'
                }}>
                  {skill.code}
                </span>
              </div>
              <button
                onClick={() => handleToggle(skill)}
                style={{
                  width: '40px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: skill.enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  position: 'absolute',
                  top: '2px',
                  left: skill.enabled ? '22px' : '2px',
                  transition: 'left 0.2s'
                }} />
              </button>
            </div>

            {skill.description && (
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--color-text-secondary)',
                marginBottom: '0.75rem'
              }}>
                {skill.description}
              </p>
            )}

            {/* 配置预览 */}
            {skill.config && Object.keys(skill.config).length > 0 && (
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                marginBottom: '0.75rem',
                padding: '0.5rem',
                backgroundColor: 'var(--color-bg-hover)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'monospace'
              }}>
                {JSON.stringify(skill.config).slice(0, 100)}...
              </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => openEditModal(skill)}
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
              <button
                onClick={() => handleDelete(skill.id)}
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

        {skills.length === 0 && (
          <div style={{
            gridColumn: '1 / -1',
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--color-text-muted)'
          }}>
            暂无技能，点击"创建技能"开始添加
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
              {editingSkill ? '编辑技能' : '创建技能'}
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
                  disabled={!!editingSkill}
                  placeholder="如: code_reader, file_analyzer"
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
                  placeholder="如: 代码读取器"
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
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="描述这个技能的功能..."
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>启用此技能</span>
                </label>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  配置 (JSON)
                </label>
                <textarea
                  value={formData.config}
                  onChange={e => setFormData({ ...formData, config: e.target.value })}
                  rows={4}
                  placeholder='{"timeout": 30000, "maxRetries": 3}'
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
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
                  {editingSkill ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}