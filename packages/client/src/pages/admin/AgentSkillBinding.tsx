import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'

interface Agent {
  id: string
  code: string
  name: string
  type: string
}

interface Skill {
  id: string
  code: string
  name: string
  description?: string
  enabled: boolean
}

interface Binding {
  skillId: string
  priority: number
  enabled: boolean
}

export default function AgentSkillBinding() {
  const { agentId } = useParams<{ agentId: string }>()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [boundSkills, setBoundSkills] = useState<Map<string, Binding>>(new Map())
  const [loading, setLoading] = useState(true)

  const token = localStorage.getItem('token')

  useEffect(() => {
    if (agentId) {
      fetchData()
    }
  }, [agentId])

  const fetchData = async () => {
    try {
      // 获取 Agent 信息
      const agentRes = await fetch(`/api/agents/${agentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (agentRes.ok) {
        const agentData = await agentRes.json()
        setAgent(agentData)

        // 构建已绑定技能映射
        const bindingMap = new Map<string, Binding>()
        if (agentData.skills) {
          agentData.skills.forEach((s: any) => {
            bindingMap.set(s.skillId, {
              skillId: s.skillId,
              priority: s.priority,
              enabled: s.enabled
            })
          })
        }
        setBoundSkills(bindingMap)
      }

      // 获取所有可用技能
      const skillsRes = await fetch(`/api/skills`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (skillsRes.ok) {
        const skillsData = await skillsRes.json()
        setAllSkills(skillsData)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBindSkill = async (skillId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ skillId, priority: 0, enabled: true })
      })

      if (res.ok) {
        setBoundSkills(prev => new Map(prev).set(skillId, {
          skillId,
          priority: 0,
          enabled: true
        }))
      }
    } catch (err) {
      console.error('Failed to bind skill:', err)
    }
  }

  const handleUnbindSkill = async (skillId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/skills/${skillId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const newMap = new Map(boundSkills)
        newMap.delete(skillId)
        setBoundSkills(newMap)
      }
    } catch (err) {
      console.error('Failed to unbind skill:', err)
    }
  }

  const handleToggleSkill = async (skillId: string, enabled: boolean) => {
    try {
      // 重新绑定以更新状态
      const res = await fetch(`/api/agents/${agentId}/skills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          skillId,
          priority: boundSkills.get(skillId)?.priority || 0,
          enabled
        })
      })

      if (res.ok) {
        setBoundSkills(prev => {
          const newMap = new Map(prev)
          const existing = newMap.get(skillId)
          if (existing) {
            newMap.set(skillId, { ...existing, enabled })
          }
          return newMap
        })
      }
    } catch (err) {
      console.error('Failed to toggle skill:', err)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        加载中...
      </div>
    )
  }

  const boundSkillIds = Array.from(boundSkills.keys())

  return (
    <div style={{ padding: 'var(--spacing-lg)', maxWidth: '800px', margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <Link
          to="/admin/agents"
          style={{
            fontSize: '0.875rem',
            color: 'var(--color-primary)',
            textDecoration: 'none',
            marginBottom: '0.5rem',
            display: 'inline-block'
          }}
        >
          ← 返回 Agent 列表
        </Link>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginTop: '0.5rem' }}>
          绑定技能: {agent?.name}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          为 {agent?.name} ({agent?.code}) 分配技能和能力
        </p>
      </div>

      {/* 已绑定技能 */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          已绑定技能 ({boundSkillIds.length})
        </h2>

        {boundSkillIds.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)'
          }}>
            暂无绑定技能，从下方选择技能进行绑定
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {boundSkillIds.map(skillId => {
              const skill = allSkills.find(s => s.id === skillId)
              const binding = boundSkills.get(skillId)
              if (!skill) return null

              return (
                <div
                  key={skillId}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--color-bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{skill.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {skill.code}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => handleToggleSkill(skillId, !binding?.enabled)}
                      style={{
                        width: '40px',
                        height: '20px',
                        borderRadius: '10px',
                        backgroundColor: binding?.enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
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
                        left: binding?.enabled ? '22px' : '2px',
                        transition: 'left 0.2s'
                      }} />
                    </button>

                    <button
                      onClick={() => handleUnbindSkill(skillId)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-error)',
                        border: '1px solid var(--color-error)',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      解除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 可用技能 */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          可用技能
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {allSkills.filter(s => !boundSkillIds.includes(s.id)).map(skill => (
            <div
              key={skill.id}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: skill.enabled ? 1 : 0.5
              }}
            >
              <div>
                <div style={{ fontWeight: 500 }}>{skill.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {skill.code}
                </div>
              </div>

              <button
                onClick={() => handleBindSkill(skill.id)}
                disabled={!skill.enabled}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: skill.enabled ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  color: 'white',
                  border: 'none',
                  fontSize: '0.75rem',
                  cursor: skill.enabled ? 'pointer' : 'not-allowed'
                }}
              >
                绑定
              </button>
            </div>
          ))}

          {allSkills.length === 0 && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)'
            }}>
              暂无可用技能，请先创建技能
            </div>
          )}
        </div>
      </div>
    </div>
  )
}