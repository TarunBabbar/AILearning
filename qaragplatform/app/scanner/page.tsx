'use client'

import { useState } from 'react'
import { ScanSearch, Upload, FileText, Code, ChevronRight, Check, AlertTriangle, BarChart3, Zap } from 'lucide-react'

interface ScanResult {
  framework: string
  locatorQuality: number
  readinessScore: number
  totalTests: number
  passing: number
  failing: number
  issues: { type: 'error' | 'warning' | 'info'; message: string }[]
}

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleScan = () => {
    setScanning(true)
    setResult(null)
    setTimeout(() => {
      setResult({
        framework: 'Playwright / TypeScript',
        locatorQuality: 72,
        readinessScore: 64,
        totalTests: 48,
        passing: 31,
        failing: 17,
        issues: [
          { type: 'error', message: '12 tests use brittle CSS selectors — switch to data-testid attributes' },
          { type: 'warning', message: '8 tests have hardcoded timeouts > 10s' },
          { type: 'warning', message: 'No accessibility assertions found in any test' },
          { type: 'info', message: 'Page Object Model pattern detected in 60% of spec files' },
          { type: 'info', message: '3 test files exceed 200 lines — consider splitting' },
        ],
      })
      setScanning(false)
    }, 2500)
  }

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)',
          color: '#10B981', marginBottom: 8, display: 'inline-block'
        }}>
          NEW
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '8px 0 4px' }}>
          Project Scanner
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
          Analyse framework, locator quality & readiness score before migrating.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleScan() }}
        style={{
          border: `2px dashed ${dragOver ? '#10B981' : 'var(--border)'}`,
          borderRadius: 12, padding: 48, textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(16,185,129,0.04)' : 'var(--surface)',
          transition: 'border-color 0.15s, background 0.15s',
          marginBottom: 24,
        }}
      >
        <Upload size={32} color="#9E9485" style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          <span style={{ color: '#10B981', fontWeight: 600 }}>Drop your project</span> or click to scan
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 0 0' }}>
          Supports Playwright, Cypress, Selenium, Robot Framework, and more
        </p>
      </div>

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        style={{
          width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none',
          background: scanning ? '#9E9485' : 'linear-gradient(135deg, #10B981, #059669)',
          color: 'white', fontSize: 13, fontWeight: 600,
          cursor: scanning ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginBottom: 24,
        }}
      >
        <ScanSearch size={14} />
        {scanning ? 'Scanning project...' : 'Start Scan'}
      </button>

      {/* Results */}
      {result && (
        <div>
          {/* Score Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
              padding: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Code size={12} color="#9E9485" />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Framework
                </span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {result.framework}
              </p>
            </div>
            <div style={{
              background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
              padding: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <BarChart3 size={12} color="#9E9485" />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Locator Quality
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <p style={{
                  fontSize: 20, fontWeight: 800, margin: 0,
                  color: result.locatorQuality >= 70 ? '#10B981' : result.locatorQuality >= 40 ? '#D97706' : '#EF4444'
                }}>
                  {result.locatorQuality}
                </p>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ 100</span>
              </div>
            </div>
            <div style={{
              background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
              padding: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Zap size={12} color="#9E9485" />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Readiness Score
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <p style={{
                  fontSize: 20, fontWeight: 800, margin: 0,
                  color: result.readinessScore >= 70 ? '#10B981' : result.readinessScore >= 40 ? '#D97706' : '#EF4444'
                }}>
                  {result.readinessScore}
                </p>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/ 100</span>
              </div>
            </div>
          </div>

          {/* Test Stats */}
          <div style={{
            background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
            padding: 14, marginBottom: 20
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>
              Test Results
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{result.totalTests}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>Total Tests</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#10B981', margin: 0 }}>{result.passing}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>Passing</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#EF4444', margin: 0 }}>{result.failing}</p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>Failing</p>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#D97706', margin: 0 }}>
                  {Math.round((result.passing / result.totalTests) * 100)}%
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>Pass Rate</p>
              </div>
            </div>
          </div>

          {/* Issues */}
          <div style={{
            background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Issues Found
              </p>
            </div>
            {result.issues.map((issue, idx) => (
              <div key={idx} style={{
                padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 8,
                borderBottom: idx < result.issues.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                {issue.type === 'error' ? (
                  <AlertTriangle size={12} color="#EF4444" style={{ marginTop: 1 }} />
                ) : issue.type === 'warning' ? (
                  <AlertTriangle size={12} color="#D97706" style={{ marginTop: 1 }} />
                ) : (
                  <Check size={12} color="#3B82F6" style={{ marginTop: 1 }} />
                )}
                <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
                  {issue.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
