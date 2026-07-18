'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, BookOpen, ChevronDown, FileText, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
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

interface DocItem {
  id: string
  name: string
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [showDocs, setShowDocs] = useState(false)
  const [showModels, setShowModels] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/documents').then(r => r.json()).then(data => setDocs(data.documents || []))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async () => {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMsg.content,
          documentIds: selectedDocs.length > 0 ? selectedDocs : undefined,
          model: selectedModel,
        }),
      })

      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || 'No response',
        sources: data.sources || [],
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your OpenRouter API key in Settings and try again.',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        background: 'var(--surface)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #D97706, #F59E0B)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={14} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>AI Q&A Agent</h2>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Ask questions about your documents</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* Model Selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowModels(!showModels)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', fontSize: 12, color: 'var(--text-2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              <Bot size={12} />
              {FREE_MODELS.find(m => m.id === selectedModel)?.name.split(' ').slice(0, 2).join(' ') || 'Model'}
              <ChevronDown size={12} />
            </button>
            {showModels && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 100,
                width: 320, maxHeight: 300, overflowY: 'auto'
              }}>
                {FREE_MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModel(m.id); setShowModels(false) }}
                    style={{
                      width: '100%', padding: '10px 14px', textAlign: 'left',
                      background: selectedModel === m.id ? 'rgba(217,119,6,0.08)' : 'transparent',
                      border: 'none', cursor: 'pointer', display: 'block',
                      borderBottom: '1px solid var(--border)'
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{m.name}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>{m.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Doc Selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDocs(!showDocs)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg)', fontSize: 12, color: 'var(--text-2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}
            >
              <BookOpen size={12} />
              {selectedDocs.length > 0 ? `${selectedDocs.length} docs` : 'All docs'}
              <ChevronDown size={12} />
            </button>
            {showDocs && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)', zIndex: 100,
                width: 250, maxHeight: 250, overflowY: 'auto'
              }}>
                <button
                  onClick={() => { setSelectedDocs([]); setShowDocs(false) }}
                  style={{
                    width: '100%', padding: '10px 14px', textAlign: 'left',
                    background: selectedDocs.length === 0 ? 'rgba(217,119,6,0.08)' : 'transparent',
                    border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    fontSize: 12, color: 'var(--text)'
                  }}
                >
                  All documents
                </button>
                {docs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocs(prev =>
                        prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                      )
                    }}
                    style={{
                      width: '100%', padding: '10px 14px', textAlign: 'left',
                      background: selectedDocs.includes(doc.id) ? 'rgba(217,119,6,0.08)' : 'transparent',
                      border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      fontSize: 12, color: 'var(--text)'
                    }}
                  >
                    {doc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', paddingTop: 120 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, #D97706, #F59E0B)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Bot size={24} color="white" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
                What would you like to know?
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                Ask questions about your documents. The AI will search through your knowledge base and provide answers with source citations.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className="message-enter" style={{
              display: 'flex', gap: 12, padding: '16px 24px',
              background: msg.role === 'assistant' ? 'rgba(217,119,6,0.03)' : 'transparent',
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'assistant' ? 'rgba(217,119,6,0.1)' : 'rgba(59,130,246,0.1)'
              }}>
                {msg.role === 'assistant' ? <Bot size={16} color="#D97706" /> : <User size={16} color="#3B82F6" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {msg.role === 'assistant' ? 'AI Agent' : 'You'}
                </p>
                <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <details style={{ fontSize: 0 }}>
                      <summary style={{
                        fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
                        cursor: 'pointer', marginBottom: 8, userSelect: 'none',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                        <FileText size={12} />
                        Sources ({msg.sources.length})
                      </summary>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {msg.sources.map((src, si) => (
                          <div key={si} style={{
                            padding: '8px 10px', borderRadius: 6,
                            background: 'var(--bg)', border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700, color: '#D97706',
                                background: 'rgba(217,119,6,0.08)',
                                padding: '1px 6px', borderRadius: 4,
                              }}>
                                #{src.chunkIndex + 1}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                                {src.docName}
                              </span>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>
                              {src.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 12, padding: '16px 24px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(217,119,6,0.1)'
              }}>
                <Bot size={16} color="#D97706" />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', margin: '0 0 8px', textTransform: 'uppercase' }}>
                  AI Agent
                </p>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
                  <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
                  <span className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '8px 12px'
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              rows={1}
              style={{
                flex: 1, border: 'none', outline: 'none', resize: 'none',
                background: 'transparent', fontSize: 13, color: 'var(--text)',
                fontFamily: 'inherit', lineHeight: 1.5, minHeight: 24, maxHeight: 120
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              style={{
                padding: '6px', borderRadius: 8, border: 'none',
                background: input.trim() && !loading ? '#D97706' : '#E8E2D9',
                color: input.trim() && !loading ? 'white' : '#9E9485',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', transition: 'background 0.15s'
              }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '6px 0 0', textAlign: 'center' }}>
            Using {FREE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel} · Responses are generated by AI
          </p>
        </div>
      </div>
    </div>
  )
}
