import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Chat from './pages/Chat'
import ChatSession from './pages/ChatSession'
import AgentManagement from './pages/admin/AgentManagement'
import SkillManagement from './pages/admin/SkillManagement'
import AgentSkillBinding from './pages/admin/AgentSkillBinding'

// 简单的认证状态管理
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 检查 localStorage 中的 token
    const token = localStorage.getItem('token')
    if (token) {
      // 验证 token 有效性
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (res.ok) {
            setIsAuthenticated(true)
          } else {
            localStorage.removeItem('token')
            setIsAuthenticated(false)
          }
        })
        .catch(() => {
          setIsAuthenticated(false)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setIsAuthenticated(false)
      setLoading(false)
    }
  }, [])

  // 登录成功后的处理
  const handleLogin = (token: string) => {
    localStorage.setItem('token', token)
    setIsAuthenticated(true)
  }

  // 登出处理
  const handleLogout = () => {
    localStorage.removeItem('token')
    setIsAuthenticated(false)
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>加载中...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />
        } />
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/chat" replace /> : <Login onLogin={handleLogin} />
        } />
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/chat" replace /> : <Register onLogin={handleLogin} />
        } />
        <Route path="/chat" element={
          isAuthenticated ? <Chat onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/chat/:sessionId" element={
          isAuthenticated ? <ChatSession onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/agents" element={
          isAuthenticated ? <AgentManagement /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/agents/:agentId/skills" element={
          isAuthenticated ? <AgentSkillBinding /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/skills" element={
          isAuthenticated ? <SkillManagement /> : <Navigate to="/login" replace />
        } />
      </Routes>
    </BrowserRouter>
  )
}

export default App