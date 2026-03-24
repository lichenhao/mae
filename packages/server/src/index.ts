import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'

import authRoutes from './routes/auth'
import sessionRoutes from './routes/sessions'
import messageRoutes from './routes/messages'
import taskRoutes from './routes/tasks'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api', messageRoutes)
app.use('/api', taskRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  socket.on('join_session', (sessionId: string) => {
    socket.join(`session:${sessionId}`)
    console.log(`Socket ${socket.id} joined session:${sessionId}`)
  })

  socket.on('leave_session', (sessionId: string) => {
    socket.leave(`session:${sessionId}`)
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

const PORT = process.env.PORT || 4000

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

export { app, io }