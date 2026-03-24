import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface UseWebSocketOptions {
  sessionId?: string
  onMessage?: (message: any) => void
  onTaskCreated?: (task: any) => void
  onTaskCompleted?: (task: any) => void
  onTaskUpdate?: (task: any) => void
  onTaskProgress?: (progress: any) => void
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { sessionId, onMessage, onTaskCreated, onTaskCompleted, onTaskUpdate, onTaskProgress } = options
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    // 创建 socket 连接
    const socket = io('/', {
      transports: ['websocket', 'polling']
    })

    socket.on('connect', () => {
      console.log('WebSocket connected')
      setConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setConnected(false)
    })

    // 监听消息
    if (onMessage) {
      socket.on('new_message', onMessage)
      socket.on('message_updated', onMessage)
      socket.on('message_deleted', (data: { id: string }) => {
        // 处理消息删除
        console.log('Message deleted:', data.id)
      })
    }

    // 监听任务
    if (onTaskCreated) {
      socket.on('task_created', onTaskCreated)
    }
    if (onTaskCompleted) {
      socket.on('task_completed', onTaskCompleted)
    }
    if (onTaskUpdate) {
      socket.on('task_update', onTaskUpdate)
    }
    if (onTaskProgress) {
      socket.on('task_progress', onTaskProgress)
    }

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [onMessage, onTaskCreated, onTaskCompleted, onTaskUpdate])

  // 加入会话房间
  const joinSession = useCallback((id: string) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('join_session', id)
    }
  }, [connected])

  // 离开会话房间
  const leaveSession = useCallback((id: string) => {
    if (socketRef.current && connected) {
      socketRef.current.emit('leave_session', id)
    }
  }, [connected])

  // 当 sessionId 变化时自动加入/离开
  useEffect(() => {
    if (sessionId && connected) {
      joinSession(sessionId)
      return () => {
        leaveSession(sessionId)
      }
    }
  }, [sessionId, connected, joinSession, leaveSession])

  return {
    connected,
    joinSession,
    leaveSession,
    socket: socketRef.current
  }
}