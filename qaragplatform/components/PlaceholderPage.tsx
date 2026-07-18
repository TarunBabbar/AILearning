'use client'

import { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description: string
}

export default function PlaceholderPage({ icon: Icon, title, description }: Props) {
  return (
    <div style={{ padding: 32, maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ paddingTop: 80 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(217,119,6,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px'
        }}>
          <Icon size={24} color="#D97706" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.6, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
          {description}
        </p>
      </div>
    </div>
  )
}
