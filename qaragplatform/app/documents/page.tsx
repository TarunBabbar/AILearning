'use client'

import { useEffect, useState } from 'react'
import { FileText, Trash2, Database, Clock } from 'lucide-react'

interface DocItem {
  id: string
  name: string
  type: string
  size: number
  chunks: number
  uploadedAt: string
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadDocs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/documents')
      const data = await res.json()
      setDocs(data.documents || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDocs() }, [])

  const deleteDoc = async (id: string) => {
    await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    loadDocs()
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Documents</h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 24px' }}>
        Manage your uploaded documents and knowledge base.
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 60 }} />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <FileText size={32} color="#9E9485" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>No documents uploaded yet</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0' }}>Upload documents from the Upload page to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{
              background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FileText size={16} color="#10B981" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{doc.name}</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Database size={10} /> {doc.chunks} chunks
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {formatBytes(doc.size)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={10} /> {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteDoc(doc.id)}
                style={{
                  padding: 6, borderRadius: 6, border: 'none',
                  background: 'transparent', cursor: 'pointer', color: '#9E9485',
                  transition: 'color 0.15s, background 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9E9485' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
