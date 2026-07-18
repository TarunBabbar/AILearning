'use client'

import { useEffect, useState } from 'react'
import { FileText, MessageSquare, Database, HardDrive, Upload, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalDocs: number
  totalChunks: number
  totalSize: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => setStats({
        totalDocs: data.documents?.length || 0,
        totalChunks: data.documents?.reduce((s: number, d: any) => s + (d.chunks || 0), 0) || 0,
        totalSize: data.documents?.reduce((s: number, d: any) => s + d.size, 0) || 0,
      }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6, marginBottom: 0 }}>
          Welcome to your QA RAG Platform. Upload documents and ask AI-powered questions.
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon={FileText} label="Documents" value={loading ? '...' : stats?.totalDocs || 0} color="#D97706" />
        <StatCard icon={Database} label="Total Chunks" value={loading ? '...' : stats?.totalChunks || 0} color="#8B5CF6" />
        <StatCard icon={HardDrive} label="Storage Used" value={loading ? '...' : formatSize(stats?.totalSize || 0)} color="#10B981" />
        <StatCard icon={MessageSquare} label="Model" value="Nemotron-3" color="#3B82F6" />
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <ActionCard
          icon={Upload}
          title="Upload Documents"
          description="Upload PDF, TXT, or DOCX files to build your knowledge base"
          href="/upload"
          accent="#D97706"
        />
        <ActionCard
          icon={Zap}
          title="Ask Questions"
          description="Ask AI-powered questions about your uploaded documents"
          href="/ai"
          accent="#8B5CF6"
        />
        <ActionCard
          icon={FileText}
          title="Browse Documents"
          description="View and manage all your uploaded documents"
          href="/documents"
          accent="#10B981"
        />
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
      padding: 20, display: 'flex', alignItems: 'flex-start', gap: 14
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '4px 0 0' }}>{value}</p>
      </div>
    </div>
  )
}

function ActionCard({ icon: Icon, title, description, href, accent }: { icon: any; title: string; description: string; href: string; accent: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        padding: 24, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex', flexDirection: 'column', gap: 12
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}20` }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon size={16} color={accent} />
          </div>
          <ArrowRight size={16} color={accent} />
        </div>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{title}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0', lineHeight: 1.5 }}>{description}</p>
        </div>
      </div>
    </Link>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
