'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Database, ArrowRight } from 'lucide-react'
import { SUPPORTED_LABEL } from '@/lib/formats'
import UploadPanel from '@/components/UploadPanel'

const STACK = ['Next.js', 'OpenRouter', 'Pinecone', 'Vercel']

// The point of the app: the whole RAG flow, named.
const STEPS = [
  { n: 1, title: 'Upload', detail: SUPPORTED_LABEL },
  { n: 2, title: 'Extract & chunk', detail: 'Split into overlapping pieces' },
  { n: 3, title: 'Embed', detail: 'OpenRouter turns each chunk into a vector' },
  { n: 4, title: 'Store', detail: 'Vectors are upserted into Pinecone' },
  { n: 5, title: 'Retrieve', detail: 'The closest chunks to your question' },
  { n: 6, title: 'Answer', detail: 'An OpenRouter LLM answers from those chunks only' },
]

export default function Dashboard() {
  const [stats, setStats] = useState<{ docs: number; chunks: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        const docs = data.documents || []
        setStats({ docs: docs.length, chunks: docs.reduce((s: number, d: any) => s + (d.chunks || 0), 0) })
      })
      .catch(() => setStats({ docs: 0, chunks: 0 }))
      .finally(() => setLoading(false))
  }, [refreshKey])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 28px 48px' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
              QA RAG Platform
            </h1>
            <span style={{ width: 1, height: 14, background: 'var(--border)' }} />
            {STACK.map((s, i) => (
              <span key={s} style={{ fontSize: 10.5, color: 'var(--text-3)' }}>
                {i > 0 && <span style={{ marginRight: 8, color: 'var(--border)' }}>·</span>}
                {s}
              </span>
            ))}
          </div>
          <Link href="/ask" style={{
            display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none',
            padding: '7px 14px', borderRadius: 8, background: '#D97706', color: 'white',
            fontSize: 12.5, fontWeight: 600
          }}>
            Ask a question <ArrowRight size={13} />
          </Link>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '8px 0 0', lineHeight: 1.6, maxWidth: 720 }}>
          Upload a document → it is chunked and embedded → the vectors go into Pinecone → an OpenRouter LLM answers
          from the retrieved chunks only, citing its sources. Retrieval-augmented generation, end to end.
        </p>
      </header>

      {/* The flow */}
      <section style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '14px 16px', marginBottom: 18,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14
      }}>
        {STEPS.map(s => (
          <div key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.3)',
                color: '#B45309', fontSize: 9.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{s.n}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.title}</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.45, paddingLeft: 24 }}>
              {s.detail}
            </p>
          </div>
        ))}
      </section>

      {/* The two numbers that matter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <MiniStat icon={FileText} label="Documents" value={loading ? '…' : stats?.docs ?? 0} color="#D97706" />
        <MiniStat icon={Database} label="Total chunks" value={loading ? '…' : stats?.chunks ?? 0} color="#8B5CF6" />
      </div>

      <UploadPanel onUploaded={() => setRefreshKey(k => k + 1)} />
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flex: 1,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px'
    }}>
      <Icon size={15} color={color} />
      <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
    </div>
  )
}
