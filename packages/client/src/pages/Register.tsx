import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface RegisterProps {
  onLogin: (token: string) => void
}

export default function Register({ onLogin }: RegisterProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.errors?.[0]?.message || '注册失败')
      }

      onLogin(data.token)
      navigate('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--color-bg)',
      padding: 'var(--spacing-md)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: 'var(--spacing-xl)',
        backgroundColor: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--color-border)'
      }}>
        {/* Logo */}
        <div style={{
          width: '60px',
          height: '60px',
          margin: '0 auto var(--spacing-lg)',
          backgroundColor: 'var(--color-primary)',
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px'
        }}>
          🤖
        </div>

        <h1 style={{
          textAlign: 'center',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 600,
          marginBottom: 'var(--spacing-xl)',
          color: 'var(--color-text)'
        }}>
          注册
        </h1>

        {error && (
          <div style={{
            color: 'var(--color-error)',
            fontSize: 'var(--font-size-sm)',
            marginBottom: 'var(--spacing-md)',
            padding: 'var(--spacing-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              昵称
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              style={{ width: '100%' }}
              placeholder="你的昵称"
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%' }}
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: 'var(--spacing-xs)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%' }}
              placeholder="至少6位"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              backgroundColor: loading ? 'var(--color-gray-400)' : 'var(--color-primary)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontWeight: 500,
              marginTop: 'var(--spacing-sm)',
              transition: 'background-color var(--transition-fast)'
            }}
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div style={{
          textAlign: 'center',
          marginTop: 'var(--spacing-lg)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)'
        }}>
          已有账号？{' '}
          <a href="/login" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
            登录
          </a>
        </div>
      </div>
    </div>
  )
}