'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Upload, Search, Zap, ScanSearch, RefreshCw,
  BarChart3, FileText, Users, Plug, GitBranch, Shield,
  Webhook, BookOpen, Settings, ChevronLeft, ChevronRight, LogIn, LucideIcon
} from 'lucide-react'

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
  section?: string
}

const mainNav: NavItem[] = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/upload', icon: Upload, label: 'Upload' },
  { href: '/search', icon: Search, label: 'Explorer' },
  { href: '/ai', icon: Zap, label: 'AI Agents' },
  { href: '/scanner', icon: ScanSearch, label: 'Scanner' },
  { href: '/migration', icon: RefreshCw, label: 'Migration' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/documents', icon: FileText, label: 'Documents' },
  { href: '/team', icon: Users, label: 'Team' },
]

const platformNav: NavItem[] = [
  { href: '/connectors', icon: Plug, label: 'Connectors' },
  { href: '/graph', icon: GitBranch, label: 'Graph' },
  { href: '/audit', icon: Shield, label: 'Audit Log' },
  { href: '/webhooks', icon: Webhook, label: 'Webhooks' },
  { href: '/prompts', icon: BookOpen, label: 'Prompts' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname()

  return (
    <aside style={{
      position: 'fixed', left: 0, top: 0, height: '100vh',
      width: collapsed ? 60 : 240,
      background: '#FFFFFF',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 50, overflow: 'hidden',
      transition: 'width 0.2s ease'
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #D97706, #F59E0B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: 'white', flexShrink: 0
          }}>QA</div>
          {!collapsed && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#2D2D2D', margin: 0, whiteSpace: 'nowrap' }}>
                QA RAG Platform
              </p>
              <p style={{ fontSize: 10, color: '#9E9485', margin: 0, whiteSpace: 'nowrap' }}>
                Enterprise AI
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onToggle}
          style={{
            background: 'transparent', border: 'none', borderRadius: 6,
            padding: '4px 6px', cursor: 'pointer', color: '#9E9485',
            display: 'flex', transition: 'color 0.15s'
          }}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '7px 10px', color: '#9E9485', fontSize: 12
        }}>
          <Search size={12} />
          {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>Search...</span>}
          {!collapsed && (
            <kbd style={{
              background: 'var(--hover)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace'
            }}>⌘K</kbd>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Main */}
        {!collapsed && (
          <p style={{
            fontSize: 10, fontWeight: 700, color: '#9E9485',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '4px 12px 2px', margin: 0
          }}>Main</p>
        )}
        {mainNav.map(item => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} collapsed={collapsed} />
        ))}

        {/* Platform */}
        {!collapsed && (
          <p style={{
            fontSize: 10, fontWeight: 700, color: '#9E9485',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '12px 12px 2px', margin: 0
          }}>Platform</p>
        )}
        {platformNav.map(item => (
          <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} collapsed={collapsed} />
        ))}
      </div>

      {/* Status Bar */}
      <div style={{ padding: '8px 14px 4px', borderTop: '1px solid var(--border)' }}>
        {!collapsed && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: '#9E9485' }}>Embeddings</span>
              <span style={{ fontSize: 10, color: '#6B6258', fontWeight: 600 }}>Nemotron-3</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: '#9E9485' }}>Vector DB</span>
              <span style={{ fontSize: 10, color: '#6B6258', fontWeight: 600 }}>In-Memory</span>
            </div>
          </>
        )}
      </div>

      {/* Sign In */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px 12px' }}>
        <button style={{
          width: '100%', padding: '8px 0', borderRadius: 7,
          border: '1px solid rgba(217,119,6,0.3)',
          background: 'rgba(217,119,6,0.08)',
          color: '#D97706', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          <LogIn size={12} /> {!collapsed && 'Sign In'}
        </button>
      </div>
    </aside>
  )
}

function NavLink({ href, icon: Icon, label, active, collapsed }: { href: string; icon: LucideIcon; label: string; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? '#D97706' : '#9E9485',
        background: active ? 'rgba(217,119,6,0.1)' : 'transparent',
        border: active ? '1px solid rgba(217,119,6,0.2)' : '1px solid transparent',
        textDecoration: 'none', position: 'relative',
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'color 0.15s, background 0.15s, border-color 0.15s',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 18, background: '#D97706', borderRadius: '0 3px 3px 0'
        }} />
      )}
      <Icon size={15} style={{ flexShrink: 0, color: active ? '#D97706' : '#9E9485' }} />
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}
