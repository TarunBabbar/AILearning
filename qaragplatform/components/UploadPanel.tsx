'use client'

import { useState, useRef } from 'react'
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { ACCEPT_ATTR, SUPPORTED_LABEL, isSupported } from '@/lib/formats'

interface UploadedDoc {
  id: string
  name: string
  chunks: number
  characters?: number
}

export default function UploadPanel({ onUploaded }: { onUploaded?: () => void }) {
  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadedDoc[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (incoming: File[]) => {
    const ok = incoming.filter(f => isSupported(f.name))
    const rejected = incoming.length - ok.length
    setError(rejected > 0 ? `${rejected} file${rejected > 1 ? 's' : ''} skipped — unsupported format.` : '')
    if (ok.length > 0) setFiles(prev => [...prev, ...ok])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx))

  const uploadFiles = async () => {
    setUploading(true)
    setError('')
    const uploaded: UploadedDoc[] = []
    const failures: string[] = []

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.success) uploaded.push(data.document)
        else failures.push(`${file.name}: ${data.error || 'upload failed'}`)
      } catch (err) {
        failures.push(`${file.name}: ${(err as Error).message}`)
      }
    }

    setResults(prev => [...uploaded, ...prev])
    setFiles([])
    setUploading(false)
    if (failures.length > 0) setError(failures.join(' · '))
    if (uploaded.length > 0) onUploaded?.()
  }

  return (
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Upload a document</h2>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {SUPPORTED_LABEL} — chunked, embedded, stored in the index
        </span>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? '#D97706' : 'var(--border)'}`,
          borderRadius: 10, padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(217,119,6,0.04)' : 'var(--bg)',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <Upload size={26} color="#9E9485" style={{ marginBottom: 6 }} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          <span style={{ color: '#D97706', fontWeight: 600 }}>Click to browse</span> or drag files here
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)) }}
          style={{ display: 'none' }}
        />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {files.map((file, idx) => (
            <div key={idx} style={{
              padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: idx < files.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <File size={13} color="#9E9485" />
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatBytes(file.size)}</span>
              <button onClick={() => removeFile(idx)} aria-label="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                <X size={13} color="#9E9485" />
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={uploadFiles}
          disabled={uploading}
          style={{
            width: '100%', marginTop: 10, padding: '9px 16px', borderRadius: 8, border: 'none',
            background: uploading ? '#9E9485' : '#D97706', color: 'white',
            fontSize: 12.5, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? 'Embedding…' : `Upload & embed ${files.length} file${files.length > 1 ? 's' : ''}`}
        </button>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertCircle size={13} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: '#991B1B', lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Indexed this session
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map((doc, i) => (
              <div key={`${doc.id}-${i}`} style={{
                border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px',
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <CheckCircle size={14} color="#10B981" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.name}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
                    {doc.chunks} chunks{doc.characters ? ` · ${doc.characters.toLocaleString()} characters` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
