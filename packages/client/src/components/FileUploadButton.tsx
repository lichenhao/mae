import { useRef, useState } from 'react'

interface Attachment {
  id: string
  name: string
  type: string
  size: number
}

interface FileUploadButtonProps {
  sessionId: string
  attachments: Attachment[]
  onUploadComplete: (attachment: Attachment) => void
  onRemoveAttachment: (id: string) => void
}

export default function FileUploadButton({ sessionId, attachments, onUploadComplete, onRemoveAttachment }: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    // 模拟进度条
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + 10
      })
    }, 200)

    try {
      const token = localStorage.getItem('token')

      // 使用 UTF-8 编码创建 FormData
      const formData = new FormData()
      // 使用 encodeURIComponent 确保文件名正确编码
      const encodedFileName = encodeURIComponent(file.name)
      const fileWithUtf8Name = new File([file], encodedFileName, { type: file.type })
      formData.append('file', fileWithUtf8Name)

      const res = await fetch(`/api/sessions/${sessionId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      clearInterval(progressInterval)

      if (res.ok) {
        const data = await res.json()
        setProgress(100)
        onUploadComplete(data.file)
      } else {
        alert('上传失败')
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('上传失败')
    } finally {
      setTimeout(() => {
        setUploading(false)
        setProgress(0)
      }, 500)
      // 清空 input 以便再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {/* 上传按钮 */}
      <button
        onClick={handleClick}
        disabled={uploading}
        title={uploading ? '上传中...' : '添加附件'}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'transparent',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.5 : 1
        }}
      >
        {uploading ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>

      {/* 分割竖线 */}
      <svg width="1" height="16" viewBox="0 0 1 20" fill="none" stroke="var(--color-border)" strokeWidth="1">
        <line x1="0.5" y1="2" x2="0.5" y2="18" />
      </svg>

      {/* 附件列表 */}
      {attachments.map((attachment, index) => (
        <div
          key={attachment.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: 'var(--color-bg-hover)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: 'var(--color-text-secondary)'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span>{attachment.name || `文件 ${index + 1}`}</span>
          <button
            onClick={() => onRemoveAttachment(attachment.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}

      {/* 上传进度 */}
      {uploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
          <div style={{
            width: '40px',
            height: '4px',
            backgroundColor: 'var(--color-border)',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: 'var(--color-primary)',
              transition: 'width 0.2s'
            }} />
          </div>
          <span>{progress}%</span>
        </div>
      )}
    </>
  )
}