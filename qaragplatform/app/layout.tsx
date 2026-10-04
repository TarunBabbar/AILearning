import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'QA RAG Platform',
  description:
    'Upload any document and ask questions about it — chunked, embedded into Pinecone, and answered by an OpenRouter LLM with the sources cited.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <Sidebar />
        <main style={{ flex: 1, minWidth: 0, minHeight: '100vh' }}>{children}</main>
      </body>
    </html>
  )
}
