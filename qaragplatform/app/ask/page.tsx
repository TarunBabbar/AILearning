import AskPanel from '@/components/AskPanel'

export default function AskPage() {
  return (
    <div style={{
      height: '100vh', width: '100%', maxWidth: 1040, margin: '0 auto',
      padding: '22px 28px 24px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden'
    }}>
      <header style={{ flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>
          Ask a question
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '6px 0 0', lineHeight: 1.55 }}>
          Searches every document you have uploaded. The answer is grounded in the retrieved chunks — it cites the
          ones it used, and never answers from the model&apos;s own memory.
        </p>
      </header>
      <AskPanel />
    </div>
  )
}
