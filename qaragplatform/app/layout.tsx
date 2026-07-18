'use client'

import { useState } from 'react'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  return (
    <html lang="en">
      <body style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <div style={{ flexShrink: 0, width: sidebarCollapsed ? 60 : 240 }} />
        <main style={{ flex: 1, minHeight: '100vh', overflow: 'auto', maxWidth: '100vw' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
