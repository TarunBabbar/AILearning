'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare } from 'lucide-react'

const NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/ask', icon: MessageSquare, label: 'Ask Question' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 190, flexShrink: 0,
      background: '#FFFFFF', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0
    }}>
      <Link href="/" style={{
        padding: '16px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none'
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #D97706, #F59E0B)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10.5, fontWeight: 800, color: 'white'
        }}>QA</div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#2D2D2D', margin: 0, whiteSpace: 'nowrap' }}>
            QA RAG Platform
          </p>
          <p style={{ fontSize: 10, color: '#9E9485', margin: 0, whiteSpace: 'nowrap' }}>Document Q&amp;A demo</p>
        </div>
      </Link>

      <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: active ? 600 : 400,
              color: active ? '#D97706' : '#9E9485',
              background: active ? 'rgba(217,119,6,0.1)' : 'transparent',
              border: active ? '1px solid rgba(217,119,6,0.2)' : '1px solid transparent',
              position: 'relative'
            }}>
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 18, background: '#D97706', borderRadius: '0 3px 3px 0'
                }} />
              )}
              <Icon size={15} style={{ color: active ? '#D97706' : '#9E9485' }} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
