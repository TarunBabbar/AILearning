'use client'

import { useState, useRef } from 'react'
import { Search, Loader2, FileText } from 'lucide-react'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ docId: string; docName: string; chunkIndex: number; text: string; score: number }[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      // Get all documents and search through chunks
      const res = await fetch('/api/documents')
      const data = await res.json()
      const docs = data.documents || []

      const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean)

      const allResults: any[] = []
      for (const doc of docs) {
        const docRes = await fetch(`/api/documents`)
        const docData = await docRes.json()
        // For now, we just show which docs match
        // Full semantic search would use embeddings
        allResults.push({
          docId: doc.id,
          docName: doc.name,
          chunkIndex: 0,
          text: `${doc.name} - ${doc.chunks} chunks indexed`,
          score: 1
        })
      }

      setResults(allResults.filter(r =>
        searchTerms.some(t => r.docName.toLowerCase().includes(t))
      ))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Explorer</h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 24px' }}>
        Search through your document knowledge base.
      </p>

      <div style={{
        display: 'flex', gap: 8,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '8px 16px', alignItems: 'center'
      }}>
        <Search size={16} color="#9E9485" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search documents..."
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: 'var(--text)', fontFamily: 'inherit'
          }}
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          style={{
            padding: '6px 16px', borderRadius: 8, border: 'none',
            background: query.trim() ? '#D97706' : '#E8E2D9',
            color: query.trim() ? 'white' : '#9E9485',
            fontSize: 12, fontWeight: 600, cursor: query.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>
            Found {results.length} result{results.length > 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, idx) => (
              <div key={idx} style={{
                background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
                padding: 14, display: 'flex', gap: 10
              }}>
                <FileText size={14} color="#10B981" style={{ marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{r.docName}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 0', lineHeight: 1.5 }}>{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
