'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, ChevronDown, FileText } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FREE_MODELS, DEFAULT_MODEL } from '@/lib/openrouter'

interface Source {
  documentId: string
  docName: string
  chunkIndex: number
  text: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

export default function AskPanel() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [showModels, setShowModels] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  // Close the model menu on an outside click or Escape — a menu that only closes
  // by re-clicking its own button feels broken.
  useEffect(() => {
    if (!showModels) return
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowModels(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModels(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [showModels])

  const handleSubmit = async () => {
    if (!input.trim() || loading) return

    const question = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, model: selectedModel }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || 'No response',
        sources: data.sources || [],
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I couldn't answer that — ${(err as Error).message}. Check that OPENROUTER_API_KEY is set and the vector index is reachable.`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const currentModel = FREE_MODELS.find(m => m.id === selectedModel)

  return (
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden'
    }}>
      {/* Header — just the LLM choice */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
      }}>
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Ask a question</h2>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>
            Searches everything you have uploaded
          </p>
        </div>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowModels(!showModels)}
            style={{
              padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg)', fontSize: 11.5, color: 'var(--text-2)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            <Bot size={12} />
            {currentModel?.name || 'Model'}
            <ChevronDown size={12} />
          </button>
          {showModels && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 100,
              width: 300, maxHeight: 280, overflowY: 'auto'
            }}>
              {FREE_MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id); setShowModels(false) }}
                  style={{
                    width: '100%', padding: '9px 12px', textAlign: 'left',
                    background: selectedModel === m.id ? 'rgba(217,119,6,0.08)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'block'
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{m.name}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>{m.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 && !loading && (
          <div style={{ textAlign: 'center', paddingTop: 70 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #D97706, #F59E0B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px'
            }}>
              <Bot size={20} color="white" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
              What would you like to know?
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Upload a document above, then ask anything about it. The answer is grounded in the retrieved chunks —
              never in the model&apos;s own memory.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className="message-enter" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'assistant' ? 'rgba(217,119,6,0.1)' : 'rgba(59,130,246,0.1)'
            }}>
              {msg.role === 'assistant' ? <Bot size={14} color="#D97706" /> : <User size={14} color="#3B82F6" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {msg.role === 'assistant' ? 'AI Agent' : 'You'}
              </p>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <details style={{ marginTop: 10, fontSize: 0 }}>
                  <summary style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                    cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    <FileText size={11} />
                    Sources ({msg.sources.length})
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {msg.sources.map((src, si) => (
                      <div key={si} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: '#D97706',
                            background: 'rgba(217,119,6,0.08)', padding: '1px 6px', borderRadius: 4
                          }}>
                            #{src.chunkIndex + 1}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {src.docName}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>{src.text}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(217,119,6,0.1)'
            }}>
              <Bot size={14} color="#D97706" />
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
              <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
              <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--border)', padding: 12 }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 10px'
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents…"
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none',
              background: 'transparent', fontSize: 13, color: 'var(--text)',
              fontFamily: 'inherit', lineHeight: 1.5, minHeight: 22, maxHeight: 120
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            aria-label="Send"
            style={{
              padding: 6, borderRadius: 8, border: 'none',
              background: input.trim() && !loading ? '#D97706' : '#E8E2D9',
              color: input.trim() && !loading ? 'white' : '#9E9485',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', transition: 'background 0.15s'
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '6px 0 0', textAlign: 'center' }}>
          {currentModel?.name || selectedModel} · answers are generated by AI
        </p>
      </div>
    </section>
  )
}
