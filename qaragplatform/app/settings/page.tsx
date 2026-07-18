'use client'

import { useState } from 'react'
import { Save, Key, Bot, CheckCircle } from 'lucide-react'
import { FREE_MODELS } from '@/lib/openrouter'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // In a real app, save securely - here we just show confirmation
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ padding: 32, maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>Settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 24px' }}>
        Configure your OpenRouter API key and model preferences.
      </p>

      {/* API Key */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        padding: 24, marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Key size={16} color="#D97706" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>OpenRouter API Key</h2>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px', lineHeight: 1.5 }}>
          Get your API key from <a href="https://openrouter.ai/keys" target="_blank" style={{ color: '#D97706' }}>openrouter.ai/keys</a>.
          The API key is stored as an environment variable on the server.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-or-v1-..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: 13, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Free Models Info */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        padding: 24, marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Bot size={16} color="#8B5CF6" />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Available Free Models</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FREE_MODELS.map(m => (
            <div key={m.id} style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg)', border: '1px solid var(--border)'
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{m.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0' }}>{m.description}</p>
              <code style={{ fontSize: 10, color: '#9E9485', marginTop: 4, display: 'block' }}>{m.id}</code>
            </div>
          ))}
        </div>
      </div>

      {/* Embedding Info */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        padding: 24
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
          About Embeddings
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
          This platform uses OpenRouter's free chat models to generate text embeddings for semantic search.
          Documents are split into chunks, embedded, and stored in-memory. For production use,
          consider a dedicated embedding model and vector database like Pinecone (as used in the reference platform).
        </p>
      </div>
    </div>
  )
}
