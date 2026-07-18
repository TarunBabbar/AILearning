'use client'

import { useState, useRef } from 'react'
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface UploadedDoc {
  id: string
  name: string
  chunks: number
  uploadedAt: Date
}

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadedDoc[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.md') || f.name.endsWith('.csv') || f.name.endsWith('.docx')
    )
    if (droppedFiles.length > 0) setFiles(prev => [...prev, ...droppedFiles])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)])
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const uploadFiles = async () => {
    setUploading(true)
    setError('')
    const newResults: UploadedDoc[] = []

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()

        if (data.success) {
          newResults.push(data.document)
        } else {
          setError(data.error || 'Upload failed')
        }
      } catch (err) {
        setError('Upload failed: ' + (err as Error).message)
      }
    }

    setResults(prev => [...newResults, ...prev])
    setFiles([])
    setUploading(false)
  }

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Upload Documents</h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 24px' }}>
        Upload text files to build your knowledge base. Supports .txt, .md, .csv, and .docx files.
      </p>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#D97706' : 'var(--border)'}`,
          borderRadius: 12, padding: 48, textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(217,119,6,0.04)' : 'var(--surface)',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <Upload size={32} color="#9E9485" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          <span style={{ color: '#D97706', fontWeight: 600 }}>Click to browse</span> or drag files here
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0 0' }}>
          TXT, MD, CSV, DOCX files supported
        </p>
        <input ref={inputRef} type="file" multiple accept=".txt,.md,.csv,.docx,text/plain" onChange={handleFileSelect} style={{ display: 'none' }} />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div style={{ marginTop: 20, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </p>
          </div>
          {files.map((file, idx) => (
            <div key={idx} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: idx < files.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <File size={14} color="#9E9485" />
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{file.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatBytes(file.size)}</span>
              <button onClick={() => removeFile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X size={14} color="#9E9485" />
              </button>
            </div>
          ))}
          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={uploadFiles}
              disabled={uploading}
              style={{
                width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none',
                background: uploading ? '#9E9485' : '#D97706', color: 'white',
                fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} color="#EF4444" />
          <span style={{ fontSize: 12, color: '#991B1B' }}>{error}</span>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 12px' }}>Recently Uploaded</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map(doc => (
              <div key={doc.id} style={{
                background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <CheckCircle size={16} color="#10B981" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{doc.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                    {doc.chunks} chunks processed
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
